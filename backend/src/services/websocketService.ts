/**
 * WebSocket Service
 * 
 * Handles real-time communication for the Planning Poker application using Socket.IO.
 * Manages WebSocket connections, room management, and event handling for planning poker sessions.
 * Integrates with PlanningPokerService for business logic and state management.
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { planningPokerService, PlanningPokerService } from './planningPokerService'; // Import the service
import { JiraTicket } from '../types/planningPoker'; // Assuming JiraTicket might be part of payloads
import { JWTUtils, JWTPayload } from '../utils/jwtUtils';

/**
 * Payload interfaces for WebSocket events
 */
interface CreateSessionPayload {
  hostName: string;
  // tickets: JiraTicket[]; // Tickets will now come from the globalPbrQueue on the backend
}

interface AddToPbrQueuePayload {
  tickets: JiraTicket[];
}

interface RemoveFromPbrQueuePayload {
  ticketKey: string;
}

interface JoinSessionPayload {
  sessionId: string;
  userName: string;
}

interface VotePayload {
  sessionId: string;
  vote: string;
}

interface HostActionPayload { // For actions like reveal, next ticket, start voting
  sessionId: string;
  ticketKey?: string; // Optional, e.g., for starting vote on a specific ticket
}

/**
 * WebSocket service class that manages real-time communication
 */
class WebSocketService {
  private io: Server;
  // The PlanningPokerService will manage all session state.
  // We inject it or use a singleton instance.
  private pokerService: PlanningPokerService;

  /**
   * Creates a new WebSocket service instance
   * @param server - The HTTP server instance
   * @param pokerServiceInstance - The planning poker service instance
   */
  constructor(server: HttpServer, pokerServiceInstance: PlanningPokerService) {
    this.pokerService = pokerServiceInstance;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    if (process.env.FRONTEND_URL) {
      // Add the environment variable URL if it's not already in the list
      if (!allowedOrigins.includes(process.env.FRONTEND_URL)) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }
    }

    this.io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket'],
      path: '/socket.io',
    });

    this.initializeListeners();
  }

  /**
   * Initializes WebSocket event listeners
   * Sets up handlers for all planning poker related events
   */
  private initializeListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      const socketId = socket.id;
      console.log(`User connected with socket ID: ${socketId}`);

      // Authenticate the connection if token is provided
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      let authenticatedUser: JWTPayload | null = null;

      if (token) {
        try {
          authenticatedUser = JWTUtils.verifyToken(token);
          if (authenticatedUser) {
            console.log(`User authenticated: ${authenticatedUser.email} (${authenticatedUser.sub})`);
            // Store user info in socket for later use
            (socket as any).user = authenticatedUser;
          } else {
            console.warn(`Invalid token provided by socket ${socketId}`);
          }
        } catch (error) {
          console.error(`Token verification failed for socket ${socketId}:`, error);
        }
      } else {
        console.log(`Socket ${socketId} connected without authentication token`);
      }

      // Send current global PBR queue to the newly connected client
      try {
        const currentGlobalQueue = this.pokerService.getGlobalPbrQueue();
        socket.emit('server.pbrQueue.updated', currentGlobalQueue);
      } catch (error) {
        console.error(`Error sending initial global PBR queue to ${socketId}:`, error);
        // Optionally emit an error to the client if this is critical
      }
      
      // --- Global PBR Queue Event Handlers ---

      socket.on('client.pbrQueue.add', async (payload: AddToPbrQueuePayload) => {
        console.log(`Received client.pbrQueue.add from ${socketId}:`, payload);
        try {
          await this.handleAddTicketsToGlobalQueue(socket, payload.tickets);
        } catch (error: any) {
          console.error(`Error adding tickets to global PBR queue for ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to add tickets to PBR queue: ' + error.message });
        }
      });

      socket.on('client.pbrQueue.remove', (payload: RemoveFromPbrQueuePayload) => {
        console.log(`Received client.pbrQueue.remove from ${socketId}:`, payload);
        try {
          this.pokerService.removeTicketFromGlobalPbrQueue(payload.ticketKey);
          // pokerService will trigger broadcast
        } catch (error: any) {
          console.error(`Error removing ticket from global PBR queue for ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to remove ticket from PBR queue: ' + error.message });
        }
      });

      socket.on('client.pbrQueue.clear', () => {
        console.log(`Received client.pbrQueue.clear from ${socketId}`);
        try {
          this.pokerService.clearGlobalPbrQueue();
          // pokerService will trigger broadcast
        } catch (error: any) {
          console.error(`Error clearing global PBR queue for ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to clear PBR queue: ' + error.message });
        }
      });
      
      // --- Planning Poker Session Event Handlers ---

      /**
       * Handles session creation requests
       * Creates a new planning poker session with the specified host and tickets
       */
      socket.on('createSession', (payload: CreateSessionPayload) => {
        console.log(`Received createSession from ${socketId}:`, payload);
        try {
          // Tickets are no longer passed from client; pokerService uses its globalPbrQueue
          const session = this.pokerService.createSession(payload.hostName, socketId);
          // The pokerService's createSession method should handle broadcasting/notifying the host.
          // If direct feedback is needed here:
          // socket.emit('sessionCreated', session); // Send full session state back to host
        } catch (error: any) {
          console.error(`Error creating session for ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to create session: ' + error.message });
        }
      });

      /**
       * Handles session join requests
       * Allows users to join an existing planning poker session
       */
      socket.on('joinSession', (payload: JoinSessionPayload) => {
        console.log(`Received joinSession from ${socketId}:`, payload);
        try {
          const session = this.pokerService.joinSession(payload.sessionId, payload.userName, socketId);
          if (session) {
            // Join the socket.io room for this session
            socket.join(payload.sessionId);
            // Send immediate confirmation to the joining user
            socket.emit('sessionUpdated', session);
            // Broadcast the update to all other users in the session
            socket.to(payload.sessionId).emit('sessionUpdated', session);
          } else {
            socket.emit('error', { 
              message: `Failed to join session ${payload.sessionId}. Session not found or user already in session.` 
            });
          }
        } catch (error: any) {
          console.error(`Error joining session for ${socketId}:`, error);
          socket.emit('error', { 
            message: `Failed to join session: ${error.message}` 
          });
        }
      });

      /**
       * Handles vote submissions
       * Processes votes from participants in a planning poker session
       */
      socket.on('submitVote', (payload: VotePayload) => {
        console.log(`Received submitVote from ${socketId}:`, payload);
        try {
          this.pokerService.submitVote(payload.sessionId, socketId, payload.vote);
          // pokerService's submitVote handles broadcasting updates.
        } catch (error: any) {
          console.error(`Error submitting vote for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to submit vote: ' + error.message });
        }
      });

      socket.on('clearSession', (payload: { sessionId: string }) => {
        console.log(`Received clearSession from ${socketId}:`, payload);
        try {
          this.pokerService.clearSession(payload.sessionId, socketId);
          // The session will be deleted and all users will be notified
        } catch (error: any) {
          console.error(`Error clearing session ${payload.sessionId} by ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to clear session: ' + error.message });
        }
      });

      socket.on('leaveSession', (payload: { sessionId: string }) => {
        console.log(`Received leaveSession from ${socketId}:`, payload);
        try {
          const success = this.pokerService.leaveSession(payload.sessionId, socketId);
          if (success) {
            socket.emit('sessionLeft', { sessionId: payload.sessionId });
          } else {
            socket.emit('error', { message: 'Failed to leave session: Invalid session' });
          }
        } catch (error: any) {
          console.error(`Error leaving session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to leave session: ' + error.message });
        }
      });

      /**
       * Handles vote reveal requests
       * Allows the host to reveal all votes for the current ticket
       */
      socket.on('revealVotes', (payload: HostActionPayload) => {
        console.log(`Received revealVotes from ${socketId}:`, payload);
        try {
          this.pokerService.revealVotes(payload.sessionId, socketId);
          // pokerService's revealVotes handles broadcasting.
        } catch (error: any) {
          console.error(`Error revealing votes for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to reveal votes: ' + error.message });
        }
      });

      /**
       * Handles voting start requests
       * Allows the host to start voting on a specific ticket
       */
      socket.on('startVoting', (payload: HostActionPayload) => {
        console.log(`Received startVoting from ${socketId}:`, payload);
        try {
          const updatedSession = this.pokerService.startVoting(payload.sessionId, socketId, payload.ticketKey);
          if (updatedSession) {
            // Broadcast the session update to all users in the session
            this.io.to(payload.sessionId).emit('sessionUpdated', updatedSession);
            console.log(`Broadcasted session update after starting voting for session ${payload.sessionId}`);
          } else {
            socket.emit('error', { message: 'Failed to start voting: Invalid session or not host' });
          }
        } catch (error: any) {
          console.error(`Error starting voting for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to start voting: ' + error.message });
        }
      });
      
      /**
       * Handles next ticket requests
       * Allows the host to move to the next ticket in the session
       */
      socket.on('nextTicket', (payload: HostActionPayload) => {
        console.log(`Received nextTicket from ${socketId}:`, payload);
        try {
          this.pokerService.nextTicket(payload.sessionId, socketId);
          // pokerService's nextTicket handles broadcasting.
        } catch (error: any) {
          console.error(`Error moving to next ticket for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to move to next ticket: ' + error.message });
        }
      });

      /**
       * Handles host transfer requests
       * Allows the current host to transfer host role to another user
       */
      socket.on('transferHost', (payload: { sessionId: string, newHostId: string }) => {
        console.log(`Received transferHost from ${socketId}:`, payload);
        try {
          const updatedSession = this.pokerService.transferHost(payload.sessionId, socketId, payload.newHostId);
          if (updatedSession) {
            // The broadcast is handled by the pokerService
            console.log(`Host role transferred successfully in session ${payload.sessionId}`);
          } else {
            socket.emit('error', { message: 'Failed to transfer host role: Invalid session or not host' });
          }
        } catch (error: any) {
          console.error(`Error transferring host role for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to transfer host role: ' + error.message });
        }
      });

      /**
       * Handles instant ticket addition to an existing session
       * Allows the host to add a ticket on-demand during the session
       */
      socket.on('addTicketToSession', async (payload: { sessionId: string, ticketKey: string }) => {
        console.log(`Received addTicketToSession from ${socketId}:`, payload);
        try {
          const updatedSession = await this.pokerService.addTicketToSession(payload.sessionId, socketId, payload.ticketKey);
          if (updatedSession) {
            console.log(`Ticket ${payload.ticketKey} added to session ${payload.sessionId} successfully`);
            // The broadcast is handled by the pokerService's addTicketToSession method
          } else {
            socket.emit('error', { message: 'Failed to add ticket: Invalid session or not host' });
          }
        } catch (error: any) {
          console.error(`Error adding ticket ${payload.ticketKey} to session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to add ticket: ' + error.message });
        }
      });

      /**
       * Handles setting final estimation for a ticket
       * Allows the host to set the agreed-upon estimation value after discussion
       */
      socket.on('setFinalEstimation', (payload: { sessionId: string, ticketKey: string, estimationValue: string }) => {
        console.log(`Received setFinalEstimation from ${socketId}:`, payload);
        try {
          const updatedSession = this.pokerService.setFinalEstimation(payload.sessionId, socketId, payload.ticketKey, payload.estimationValue);
          if (updatedSession) {
            console.log(`Final estimation set for ticket ${payload.ticketKey} in session ${payload.sessionId}: ${payload.estimationValue}`);
            // The broadcast is handled by the pokerService's setFinalEstimation method
          } else {
            socket.emit('error', { message: 'Failed to set final estimation: Invalid session or not host' });
          }
        } catch (error: any) {
          console.error(`Error setting final estimation for ticket ${payload.ticketKey} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to set final estimation: ' + error.message });
        }
      });

      /**
       * Handles restarting voting for the current ticket
       * Allows the host to restart voting during discussion phase
       */
      socket.on('restartVoting', (payload: HostActionPayload) => {
        console.log(`Received restartVoting from ${socketId}:`, payload);
        try {
          const updatedSession = this.pokerService.restartVoting(payload.sessionId, socketId);
          if (updatedSession) {
            console.log(`Voting restarted for session ${payload.sessionId}`);
            // The broadcast is handled by the pokerService's restartVoting method
          } else {
            socket.emit('error', { message: 'Failed to restart voting: Invalid session or not host' });
          }
        } catch (error: any) {
          console.error(`Error restarting voting for ${socketId} in session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to restart voting: ' + error.message });
        }
      });

      /**
       * Handles client disconnection
       * Cleans up resources and notifies the planning poker service
       */
      socket.on('disconnect', () => {
        console.log(`User disconnected with socket ID: ${socketId}`);
        this.pokerService.handleDisconnect(socketId); // Notify pokerService
      });

      socket.on('closeSession', (payload: { sessionId: string }) => {
        console.log(`Received closeSession from ${socketId}:`, payload);
        try {
          const success = this.pokerService.closeSession(payload.sessionId, socketId);
          if (!success) {
            socket.emit('error', { message: 'Failed to close session: Not authorized or invalid session' });
          }
        } catch (error: any) {
          console.error(`Error closing session ${payload.sessionId}:`, error);
          socket.emit('error', { message: 'Failed to close session: ' + error.message });
        }
      });
    });
  }

  // --- Methods for PlanningPokerService to send messages ---

  /**
   * Sends a message to a specific socket ID
   * @param socketId - The ID of the socket (user)
   * @param event - The event name
   * @param data - The data to send
   */
  public sendToSocket(socketId: string, event: string, data: any): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Broadcasts a message to all sockets in a specific room (session)
   * @param roomId - The ID of the room (session ID)
   * @param event - The event name
   * @param data - The data to send
   */
  public broadcastToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Makes a socket join a room
   * @param socketId - The ID of the socket
   * @param roomId - The ID of the room to join
   */
  public joinRoom(socketId: string, roomId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(roomId);
      console.log(`Socket ${socketId} joined room ${roomId}`);
    } else {
      console.warn(`Socket ${socketId} not found, cannot join room ${roomId}`);
    }
  }

  /**
   * Makes a socket leave a room
   * @param socketId - The ID of the socket
   * @param roomId - The ID of the room to leave
   */
  public leaveRoom(socketId: string, roomId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(roomId);
      console.log(`Socket ${socketId} left room ${roomId}`);
    } else {
      console.warn(`Socket ${socketId} not found, cannot leave room ${roomId}`);
    }
  }

  /**
   * Broadcasts the global PBR queue to all connected clients
   */
  public async broadcastGlobalPbrQueueUpdate(queue: JiraTicket[]): Promise<void> {
    try {
      const clients = await this.io.fetchSockets();
      if (clients.length > 0) {
        this.io.emit('server.pbrQueue.updated', queue);
        console.log(`Broadcasting server.pbrQueue.updated to ${clients.length} clients.`);
      } else {
        console.warn('No clients connected, skipping broadcast of server.pbrQueue.updated.');
      }
    } catch (err) {
      console.error('Error broadcasting queue update:', err);
    }
  }

  public async handleAddTicketsToGlobalQueue(socket: Socket, tickets: JiraTicket[]): Promise<void> {
    try {
      console.log('[WebSocketService] Adding tickets to global PBR queue:', tickets);
      const updatedQueue = await this.pokerService.addTicketsToGlobalPbrQueue(tickets);
      console.log('[WebSocketService] Queue updated successfully:', updatedQueue);
      await this.broadcastGlobalPbrQueueUpdate(updatedQueue);
      socket.emit('queueUpdate', updatedQueue); // Send immediate confirmation to the sender
    } catch (error) {
      console.error('[WebSocketService] Error in handleAddTicketsToGlobalQueue:', error);
      socket.emit('error', { message: 'Failed to add tickets to queue' });
      throw error; // Re-throw to trigger the error callback in the client
    }
  }

  public broadcastToSession(sessionId: string, event: string, data: any): void {
    // Get all socket IDs in the session
    const session = this.pokerService.getSession(sessionId);
    if (!session) return;

    session.users.forEach(user => {
      this.sendToSocket(user.id, event, data);
    });
  }
}

// This service needs to be instantiated with the HttpServer and PlanningPokerService instance.
// Example instantiation (would happen in your main server setup file, e.g., app.ts or server.ts):
// import { createServer } from 'http';
// import express from 'express';
// const app = express();
// const httpServer = createServer(app);
// const pokerService = new PlanningPokerService(); // or planningPokerService singleton
// const wsService = new WebSocketService(httpServer, pokerService);
// pokerService.setWebSocketCommunicator(wsService); // If using a setter method

export default WebSocketService;