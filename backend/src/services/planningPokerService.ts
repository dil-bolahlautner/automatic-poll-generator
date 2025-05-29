import { v4 as uuidv4 } from 'uuid';
import {
  PlanningPokerSession,
  PlanningPokerUser,
  JiraTicket,
} from '../types/planningPoker';
import WebSocketService from './websocketService';

export class PlanningPokerService {
  private sessions: Map<string, PlanningPokerSession> = new Map();
  private globalPbrQueue: JiraTicket[] = [];
  private webSocketService!: WebSocketService; // Will be set by setWebSocketService

  // Constructor can be kept simple or removed if not doing other setup
  constructor() {
    this.sessions = new Map(); // Explicitly clear/re-initialize sessions on instantiation
    this.globalPbrQueue = []; // Initialize global PBR queue
    console.log('PlanningPokerService initialized. Sessions and Global PBR Queue cleared. Waiting for WebSocketService.');
  }

  public setWebSocketService(wsService: WebSocketService): void {
    this.webSocketService = wsService;
    console.log('WebSocketService injected into PlanningPokerService.');
  }

  private ensureWebSocketService(): void {
    if (!this.webSocketService) {
      throw new Error('WebSocketService has not been set in PlanningPokerService.');
    }
  }

  private isUserInAnySession(userId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.users.some(u => u.id === userId)) {
        return true;
      }
    }
    return false;
  }

  // --- Global PBR Queue Management ---
  public getGlobalPbrQueue(): JiraTicket[] {
    // Return a copy to prevent direct modification of the internal array
    return [...this.globalPbrQueue];
  }

  public addTicketsToGlobalPbrQueue(ticketsToAdd: JiraTicket[]): JiraTicket[] {
    const newTickets = ticketsToAdd.filter(
      newTicket => !this.globalPbrQueue.some(existingTicket => existingTicket.key === newTicket.key)
    );
    this.globalPbrQueue.push(...newTickets);
    console.log(`Added ${newTickets.length} tickets to Global PBR Queue. Current size: ${this.globalPbrQueue.length}`);
    this.webSocketService.broadcastGlobalPbrQueueUpdate(this.globalPbrQueue);
    return [...this.globalPbrQueue];
  }

  public removeTicketFromGlobalPbrQueue(ticketKeyToRemove: string): JiraTicket[] {
    const initialLength = this.globalPbrQueue.length;
    this.globalPbrQueue = this.globalPbrQueue.filter(ticket => ticket.key !== ticketKeyToRemove);
    if (this.globalPbrQueue.length < initialLength) {
      console.log(`Removed ticket ${ticketKeyToRemove} from Global PBR Queue. Current size: ${this.globalPbrQueue.length}`);
      this.webSocketService.broadcastGlobalPbrQueueUpdate(this.globalPbrQueue);
    }
    return [...this.globalPbrQueue];
  }

  public clearGlobalPbrQueue(): JiraTicket[] {
    this.globalPbrQueue = [];
    console.log('Global PBR Queue cleared.');
    this.webSocketService.broadcastGlobalPbrQueueUpdate(this.globalPbrQueue);
    return [...this.globalPbrQueue];
  }

  // --- Session Management ---
  public createSession(hostName: string, hostWsId: string): PlanningPokerSession {
    this.ensureWebSocketService();
    
    // Use a snapshot of the current global PBR queue for the session
    const initialTickets = [...this.globalPbrQueue];
    // Consider if the globalPbrQueue should be cleared after session creation.
    // For now, it's not cleared, allowing multiple sessions to be created from the same queue
    // or for the queue to persist for other potential uses.
    // If it should be cleared, add: this.clearGlobalPbrQueue();

    if (initialTickets.length === 0) {
      throw new Error('Cannot create a session with an empty PBR queue.');
    }

    // Check if user is already in a session
    if (this.isUserInAnySession(hostWsId)) {
      console.warn(`User ${hostName} (${hostWsId}) attempted to create a session while already in one`);
      throw new Error('You are already in a session. Please leave the current session before creating a new one.');
    }

    // Generate an 8-digit numeric session ID
    const sessionId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const host: PlanningPokerUser = {
      id: hostWsId,
      name: hostName,
      isHost: true,
      hasVoted: false,
      vote: null,
    };

    const session: PlanningPokerSession = {
      id: sessionId,
      hostId: host.id,
      users: [host],
      tickets: initialTickets,
      currentTicketKey: initialTickets.length > 0 ? initialTickets[0].key : null,
      votingOpen: false,
      votesRevealed: false,
    };

    this.sessions.set(sessionId, session);
    console.log(`Planning Poker session created: ${sessionId} by host ${hostName} (${host.id})`);
    
    const hostState = this.getSessionStateForUser(session, host.id);
    if (hostState) {
      this.webSocketService.sendToSocket(host.id, 'sessionCreated', hostState);
      this.webSocketService.joinRoom(host.id, sessionId);
    }
    return hostState!;
  }

  public joinSession(sessionId: string, userName: string, userWsId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Attempted to join non-existent session: ${sessionId}`);
      return null; // Or throw an error
    }

    if (session.users.some(u => u.id === userWsId)) {
      console.warn(`User ${userName} (${userWsId}) already in session ${sessionId}`);
      // Re-send current state to this user if they reconnected
      const userState = this.getSessionStateForUser(session, userWsId);
      if (userState) {
        this.webSocketService.sendToSocket(userWsId, 'sessionUpdated', userState);
        // Ensure user is in the room if they reconnected
        this.webSocketService.joinRoom(userWsId, sessionId);
      }
      return userState;
    }

    const newUser: PlanningPokerUser = {
      id: userWsId,
      name: userName,
      isHost: false,
      hasVoted: false,
      vote: null,
    };

    session.users.push(newUser);
    this.sessions.set(sessionId, session);
    console.log(`User ${userName} (${userWsId}) joined session: ${sessionId}`);

    // Notify all users in the session about the new user & new user joins the room
    this.webSocketService.joinRoom(userWsId, sessionId);
    this.broadcastSessionUpdate(sessionId);
    return this.getSessionStateForUser(session, newUser.id);
  }

  public leaveSession(sessionId: string, userId: string): void {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Attempted to leave non-existent session: ${sessionId}`);
      return;
    }

    const userIndex = session.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      console.warn(`User ${userId} not found in session ${sessionId} for leaving.`);
      return;
    }

    const leavingUser = session.users[userIndex];
    session.users.splice(userIndex, 1);
    console.log(`User ${leavingUser.name} (${userId}) left session: ${sessionId}`);

    // Notify the leaving user that they've been removed from the session
    this.webSocketService.sendToSocket(userId, 'sessionTerminated', {
      sessionId: session.id,
      reason: 'You have left the session.'
    });

    // Check if the leaving user was the host
    if (leavingUser.isHost) {
      if (session.users.length > 0) {
        // Host left, but other users remain. Terminate the session for everyone.
        console.log(`Host ${leavingUser.name} (${userId}) left session ${sessionId}. Terminating session as host departed.`);
        // Notify remaining users BEFORE deleting the session data
        session.users.forEach(remainingUser => {
          this.webSocketService.sendToSocket(remainingUser.id, 'sessionTerminated', {
            sessionId: session.id,
            reason: 'The host has left the session.'
          });
        });
        this.sessions.delete(sessionId);
        return; // Session processing stops here as it's deleted.
      } else {
        // Host left and was the only user. The session is now empty.
        console.log(`Host ${leavingUser.name} (${userId}) left session ${sessionId}. Session was already empty and is being deleted.`);
        this.sessions.delete(sessionId);
        return;
      }
    }

    // If session becomes empty (either the leaving user was the last one, host or not)
    if (session.users.length === 0) {
      console.log(`Session ${sessionId} is empty after user ${leavingUser.name} (${userId}) left, deleting.`);
      this.sessions.delete(sessionId);
      return;
    }

    // If we reach here, it means a non-host user left, and other users still remain in the session.
    this.sessions.set(sessionId, session);
    this.broadcastSessionUpdate(sessionId); // Notify remaining users in the session about the change
  }

  public startVoting(sessionId: string, hostId: string, ticketKeyToStart?: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session || session.hostId !== hostId) {
      console.warn(`Invalid attempt to start voting for session ${sessionId} by user ${hostId}`);
      return null;
    }

    const ticketKey = ticketKeyToStart || session.currentTicketKey;
    if (!ticketKey || !session.tickets.find(t => t.key === ticketKey)) {
        console.warn(`Ticket ${ticketKey} not found in session ${sessionId}`);
        return null;
    }

    session.currentTicketKey = ticketKey;
    session.votingOpen = true;
    session.votesRevealed = false;
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.sessions.set(sessionId, session);
    console.log(`Voting started for ticket ${ticketKey} in session ${sessionId}`);
    this.broadcastSessionUpdate(sessionId);
    return this.getSessionStateForUser(session, hostId);
  }

  public submitVote(sessionId: string, userId: string, voteValue: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session || !session.votingOpen || session.votesRevealed) {
      console.warn(`Invalid attempt to vote in session ${sessionId} by user ${userId}. Voting not open or votes revealed.`);
      return null;
    }

    const user = session.users.find(u => u.id === userId);
    if (!user) {
      console.warn(`User ${userId} not found in session ${sessionId} for voting.`);
      return null;
    }

    // Update user's vote
    user.vote = voteValue;
    user.hasVoted = true;
    this.sessions.set(sessionId, session);
    console.log(`User ${user.name} (${userId}) voted ${voteValue} for ticket ${session.currentTicketKey} in session ${sessionId}`);

    // Broadcast session update to all users
    this.broadcastSessionUpdate(sessionId);
    
    // Return the session state tailored for the voting user
    return this.getSessionStateForUser(session, userId);
  }

  public revealVotes(sessionId: string, hostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session || session.hostId !== hostId || !session.votingOpen) {
      console.warn(`Invalid attempt to reveal votes for session ${sessionId} by user ${hostId}. Not host or voting not open.`);
      return null;
    }

    session.votesRevealed = true;
    session.votingOpen = false; // Typically, revealing votes closes the current round of voting.
    this.sessions.set(sessionId, session);
    console.log(`Votes revealed for ticket ${session.currentTicketKey} in session ${sessionId}`);
    this.broadcastSessionUpdate(sessionId); // Now everyone gets to see the votes
    return this.getSessionStateForUser(session, hostId);
  }

  public nextTicket(sessionId: string, hostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session || session.hostId !== hostId) {
      console.warn(`Invalid attempt to move to next ticket for session ${sessionId} by user ${hostId}`);
      return null;
    }

    const currentIndex = session.tickets.findIndex(t => t.key === session.currentTicketKey);
    if (currentIndex === -1 || currentIndex >= session.tickets.length - 1) {
      console.log(`No next ticket available or current ticket not found in session ${sessionId}.`);
      // Optionally, could set currentTicketKey to null or handle end of estimation
      session.currentTicketKey = null;
      session.votingOpen = false;
      session.votesRevealed = false;
      this.sessions.set(sessionId, session);
      this.broadcastSessionUpdate(sessionId);
      return this.getSessionStateForUser(session, hostId);
    }

    const nextTicket = session.tickets[currentIndex + 1];
    session.currentTicketKey = nextTicket.key;
    session.votingOpen = false; // Host needs to explicitly start voting for the new ticket
    session.votesRevealed = false;
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.sessions.set(sessionId, session);
    console.log(`Moved to next ticket ${nextTicket.key} in session ${sessionId}`);
    this.broadcastSessionUpdate(sessionId);
    // Host can then call startVoting for this new ticket.
    return this.getSessionStateForUser(session, hostId);
  }

  public clearSession(sessionId: string, hostId: string): void {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session || session.hostId !== hostId) {
      console.warn(`Invalid attempt to clear session ${sessionId} by user ${hostId}`);
      return;
    }

    // Notify all users that the session is being terminated
    session.users.forEach(user => {
      this.webSocketService.sendToSocket(user.id, 'sessionTerminated', {
        sessionId: session.id,
        reason: 'The host has cleared the session.'
      });
    });
    
    // Remove the session
    this.sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleared by host ${hostId}. All users have been notified.`);
  }

  public getSession(sessionId: string): PlanningPokerSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // Centralized method to broadcast updates to all users in a session
  private broadcastSessionUpdate(sessionId: string): void {
    this.ensureWebSocketService();
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Instead of iterating and sending one by one,
    // we can send a generic update to the room, and the client can adapt.
    // However, our getSessionStateForUser tailors the data.
    // So, we must send individually if the state is different per user.

    session.users.forEach(user => {
      const userSpecificState = this.getSessionStateForUser(session, user.id);
      if (userSpecificState) { // Ensure state is not null
        this.webSocketService.sendToSocket(user.id, 'sessionUpdated', userSpecificState);
      }
    });
  }

  // Method to tailor session state based on user role and voting status
  public getSessionStateForUser(session: PlanningPokerSession, userId: string): PlanningPokerSession | null {
    if (!session) return null;

    const requestingUser = session.users.find(u => u.id === userId);
    if (!requestingUser) return null;

    // Deep clone session to avoid modifying the original
    const sessionStateForUser = JSON.parse(JSON.stringify(session)) as PlanningPokerSession;

    // If votes are not revealed, handle vote visibility
    if (!sessionStateForUser.votesRevealed) {
      sessionStateForUser.users.forEach(u => {
        if (u.id !== userId) {
          // For non-hosts, only show if others have voted
          if (!requestingUser.isHost) {
            u.vote = u.hasVoted ? 'VOTED' : null;
          } else {
            // Host sees who has voted but not the actual vote value
            u.vote = u.hasVoted ? 'VOTED' : null;
          }
        }
        // Users always see their own vote
      });
    }

    return sessionStateForUser;
  }

  // Method to be called when a WebSocket connection (user) disconnects
  public handleDisconnect(userId: string): void {
    // No need to call ensureWebSocketService() here if leaveSession calls it.
    // However, if this method could be called before wsService is set, add it.
    // For now, assume leaveSession will handle the check.
    this.sessions.forEach(session => {
      const userInSession = session.users.find(u => u.id === userId);
      if (userInSession) {
        console.log(`User ${userInSession.name} (${userId}) disconnected from session ${session.id}.`);
        // WebSocketService already handles making the socket leave all rooms upon disconnect.
        this.leaveSession(session.id, userId); // This will handle logic and broadcast
      }
    });
  }
}

// Export a singleton instance. It will need WebSocketService to be injected after instantiation.
export const planningPokerService = new PlanningPokerService();
// Example of how it would be used in app.ts/server.ts:
// import { planningPokerService } from './services/planningPokerService';
// import WebSocketService from './services/websocketService';
// const httpServer = ...;
// const wsService = new WebSocketService(httpServer, planningPokerService); // Pass pokerService to WS
// planningPokerService.setWebSocketService(wsService); // Inject WS into pokerService