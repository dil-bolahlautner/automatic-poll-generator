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

/**
 * Payload interfaces for WebSocket events
 */
interface CreateSessionPayload {
  hostName: string;
  tickets: JiraTicket[]; // From frontend queue
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
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173'], // Allow common dev ports
        methods: ['GET', 'POST'],
      },
      path: '/socket.io/', // Explicitly set the default path on the server too
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
      // User's actual name/ID might come with join/create messages
      console.log(`User connected with socket ID: ${socketId}`);

      // --- Planning Poker Event Handlers ---

      /**
       * Handles session creation requests
       * Creates a new planning poker session with the specified host and tickets
       */
      socket.on('createSession', (payload: CreateSessionPayload) => {
        console.log(`Received createSession from ${socketId}:`, payload);
        try {
          const session = this.pokerService.createSession(payload.hostName, payload.tickets, socketId);
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
            socket.join(payload.sessionId); // Join the socket.io room for this session
            // pokerService's joinSession should handle broadcasting updates.
            // socket.emit('sessionJoined', session); // Send full session state to joining user
          } else {
            socket.emit('error', { message: `Failed to join session ${payload.sessionId}. Session not found or user already in session.` });
          }
        } catch (error: any) {
          console.error(`Error joining session for ${socketId}:`, error);
          socket.emit('error', { message: 'Failed to join session: ' + error.message });
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
          this.pokerService.startVoting(payload.sessionId, socketId, payload.ticketKey);
          // pokerService's startVoting handles broadcasting.
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
       * Handles client disconnection
       * Cleans up resources and notifies the planning poker service
       */
      socket.on('disconnect', () => {
        console.log(`User disconnected with socket ID: ${socketId}`);
        this.pokerService.handleDisconnect(socketId); // Notify pokerService
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
    this.io.to(socketId).emit(event, data);
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