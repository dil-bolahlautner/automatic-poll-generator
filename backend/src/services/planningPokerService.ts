import { v4 as uuidv4 } from 'uuid';
import {
  PlanningPokerSession,
  PlanningPokerUser,
  JiraTicket,
} from '../types/planningPoker';
import WebSocketService from './websocketService';

export class PlanningPokerService {
  private sessions: Map<string, PlanningPokerSession> = new Map();
  private webSocketService!: WebSocketService; // Will be set by setWebSocketService

  // Constructor can be kept simple or removed if not doing other setup
  constructor() {
    console.log('PlanningPokerService initialized. Waiting for WebSocketService.');
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

  public createSession(hostName: string, initialTickets: JiraTicket[], hostWsId: string): PlanningPokerSession {
    this.ensureWebSocketService();
    const sessionId = uuidv4();
    const host: PlanningPokerUser = {
      id: hostWsId, // Use WebSocket connection ID or a generated UUID
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
    // Notify host about successful session creation
    // The WebSocketService's 'createSession' handler already has the socket, so it can emit directly.
    // However, if we want pokerService to explicitly push, it can.
    // Let's assume WebSocketService handles the initial emit upon receiving 'createSession'
    // and pokerService is responsible for subsequent broadcasts.
    // For now, let's make pokerService responsible for sending the confirmation.
    const hostState = this.getSessionStateForUser(session, host.id);
    if (hostState) {
        this.webSocketService.sendToSocket(host.id, 'sessionCreated', hostState);
        // The host's socket also needs to join the session room
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

    if (session.users.length === 0) {
      console.log(`Session ${sessionId} is empty, deleting.`);
      this.sessions.delete(sessionId);
      // Optionally notify other services or clean up resources
      // No broadcast needed if session is deleted.
      return;
    }

    // If host leaves, a new host could be assigned or session ended.
    // For now, if host leaves, we'll just update. This needs more robust handling.
    if (leavingUser.isHost && session.users.length > 0) {
      // Simple: make the next user the host. Or end session.
      // session.users[0].isHost = true;
      // session.hostId = session.users[0].id;
      // console.log(`New host for session ${sessionId}: ${session.users[0].name} (${session.users[0].id})`);
      // For now, let's assume host leaving might end the session or require manual intervention.
      // This part of logic needs to be defined by product requirements.
      console.warn(`Host ${leavingUser.name} left session ${sessionId}. Session may become unmanageable without a host.`);
    }

    this.sessions.set(sessionId, session);
    // User automatically leaves all rooms on disconnect by socket.io
    // If we need to manually make them leave the room: this.webSocketService.leaveRoom(userId, sessionId);
    this.broadcastSessionUpdate(sessionId);
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

    user.vote = voteValue;
    user.hasVoted = true;
    this.sessions.set(sessionId, session);
    console.log(`User ${user.name} (${userId}) voted ${voteValue} for ticket ${session.currentTicketKey} in session ${sessionId}`);

    // Notify host about vote status, and user about their vote confirmation.
    // Other users should not see the vote value yet.
    this.broadcastSessionUpdate(sessionId); // This will send tailored states
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
    if (!requestingUser) return null; // Should not happen if userId is from session.users

    // Deep clone session to avoid modifying the original in-memory session object
    const sessionStateForUser = JSON.parse(JSON.stringify(session)) as PlanningPokerSession;

    // If votes are not revealed, non-host users should not see others' votes.
    // Host can see who has voted, but not their actual votes until revealed.
    if (!sessionStateForUser.votesRevealed) {
      sessionStateForUser.users.forEach(u => {
        if (u.id !== userId && !requestingUser.isHost) {
          // Other users' votes are hidden from non-hosts
          u.vote = u.hasVoted ? 'VOTED' : null; // Show 'VOTED' or null, not the actual vote
        } else if (u.id !== userId && requestingUser.isHost) {
          // Host sees who has voted, but not the actual vote value
           u.vote = u.hasVoted ? 'VOTED' : null;
        }
        // Users always see their own vote, hosts always see their own vote
      });
    }
    // If votes ARE revealed, everyone sees all votes (default behavior of JSON.parse(JSON.stringify(session)))

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