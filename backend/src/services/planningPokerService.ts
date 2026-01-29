/**
 * Planning Poker Service
 * 
 * Manages real-time planning poker sessions for agile story point estimation.
 * Handles session lifecycle, voting, consensus detection, and JIRA integration.
 * 
 * Key responsibilities:
 * - Session management (create, join, leave, close)
 * - Voting workflow (start, submit, reveal, next ticket)
 * - Global PBR queue management
 * - JIRA ticket integration
 * - WebSocket communication coordination
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  PlanningPokerSession,
  PlanningPokerUser,
  JiraTicket,
} from '../types/planningPoker';
import WebSocketService from './websocketService';
import { jiraConfig } from '../config/jira';
import { logAuditEvent, AuditEventType, AuditSeverity } from '../utils/auditLogger';

// Configuration constants
const JIRA_HOST = process.env.JIRA_HOST || 'https://diligentbrands.atlassian.net';
const JIRA_BASE_URL = `${JIRA_HOST}/rest/api/3`;
const JIRA_TIMEOUT = 10000; // 10 seconds
const SESSION_ID_LENGTH = 8;

// JIRA API authentication configuration
const jiraAuth = {
  username: process.env.JIRA_USERNAME || '',
  password: process.env.JIRA_API_TOKEN || ''
};



/**
 * Planning Poker Service
 * 
 * Manages the complete lifecycle of planning poker sessions including:
 * - Session creation and management
 * - Real-time voting coordination
 * - JIRA ticket integration
 * - Consensus detection and finalization
 */
export class PlanningPokerService {
  private sessions: Map<string, PlanningPokerSession> = new Map();
  private globalPbrQueue: JiraTicket[] = [];
  private webSocketService!: WebSocketService;

  constructor() {
    this.sessions = new Map();
    this.globalPbrQueue = [];
    console.log('PlanningPokerService initialized. Sessions and Global PBR Queue cleared. Waiting for WebSocketService.');
  }

  /**
   * Sets the WebSocket service for real-time communication
   * @param wsService - The WebSocket service instance
   */
  public setWebSocketService(wsService: WebSocketService): void {
    this.webSocketService = wsService;
    console.log('WebSocketService injected into PlanningPokerService.');
  }

  /**
   * Ensures WebSocket service is available before operations
   * @throws Error if WebSocket service is not set
   */
  private ensureWebSocketService(): void {
    if (!this.webSocketService) {
      throw new Error('WebSocketService has not been set in PlanningPokerService.');
    }
  }

  /**
   * Checks if a user is already participating in any session
   * @param userId - The user ID to check
   * @returns true if user is in any session, false otherwise
   */
  private isUserInAnySession(userId: string): boolean {
    return Array.from(this.sessions.values()).some(session =>
      session.users.some(user => user.id === userId)
    );
  }

  /**
   * Generates a unique 8-digit numeric session ID
   * @returns A unique session ID string
   */
  private generateSessionId(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Creates a new Planning Poker user
   * @param id - User's WebSocket ID
   * @param name - User's display name
   * @param isHost - Whether the user is the session host
   * @returns A new PlanningPokerUser object
   */
  private createUser(id: string, name: string, isHost: boolean = false): PlanningPokerUser {
    return {
      id,
      name,
      isHost,
      hasVoted: false,
      vote: null,
    };
  }

  /**
   * Validates session access permissions
   * @param session - The session to validate
   * @param userId - The user ID requesting access
   * @param requireHost - Whether the user must be the host
   * @returns true if access is allowed, false otherwise
   */
  private validateSessionAccess(session: PlanningPokerSession | null, userId: string, requireHost: boolean = false): boolean {
    if (!session) return false;
    if (requireHost && session.hostId !== userId) return false;
    return session.users.some(user => user.id === userId);
  }

  /**
   * Finds a session by ID with validation
   * @param sessionId - The session ID to find
   * @returns The session if found, null otherwise
   */
  private findSession(sessionId: string): PlanningPokerSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Updates session state and notifies all participants
   * @param sessionId - The session ID to update
   */
  private updateAndBroadcastSession(sessionId: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;

    this.sessions.set(sessionId, session);
    this.broadcastSessionUpdate(sessionId);
  }

  // --- Global PBR Queue Management ---

  /**
   * Gets a copy of the global PBR queue
   * @returns A copy of the global PBR queue array
   */
  public getGlobalPbrQueue(): JiraTicket[] {
    return [...this.globalPbrQueue];
  }

  /**
   * Transforms a JIRA issue into our ticket format
   * @param issue - The JIRA issue data
   * @returns A JiraTicket object
   */
  private transformJiraIssueToTicket(issue: any): JiraTicket {
    const blockingIssues = this.extractBlockingIssues(issue);
    const fixVersions = this.extractFixVersions(issue);
    const linkedIssues = this.extractLinkedIssues(issue);

    return {
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      labels: issue.fields.labels || [],
      reporter: issue.fields.reporter?.displayName,
      url: `${JIRA_HOST}/browse/${issue.key}`,
      fixVersions,
      linkedIssues,
      blockingIssues,
             parent: issue.fields.parent ? {
         key: issue.fields.parent.key,
         summary: issue.fields.parent.fields.summary
       } : undefined
    };
  }

  /**
   * Extracts blocking issues from JIRA issue data
   * @param issue - The JIRA issue data
   * @returns Array of blocking issue objects
   */
  private extractBlockingIssues(issue: any): Array<{ key: string; summary: string; status: string; type: string }> {
    return (issue.fields.issuelinks || [])
      .filter((link: any) => link.type.name === 'Blocks' && link.outwardIssue)
      .map((link: any) => ({
        key: link.outwardIssue.key,
        summary: link.outwardIssue.fields.summary,
        status: link.outwardIssue.fields.status.name,
        type: link.outwardIssue.fields.issuetype.name
      }));
  }

  /**
   * Extracts fix versions from JIRA issue data
   * @param issue - The JIRA issue data
   * @returns Array of fix version objects
   */
  private extractFixVersions(issue: any): Array<{ id: string; name: string; released: boolean }> {
    return (issue.fields.fixVersions || []).map((version: any) => ({
      id: version.id,
      name: version.name,
      released: version.released
    }));
  }

  /**
   * Extracts linked issues from JIRA issue data
   * @param issue - The JIRA issue data
   * @returns Array of linked issue objects
   */
  private extractLinkedIssues(issue: any): Array<{ type: string; key: string; direction: 'inward' | 'outward' }> {
    return (issue.fields.issuelinks || []).map((link: any) => {
      const isInward = !!link.inwardIssue;
      return {
        type: isInward ? link.type.inward : link.type.outward,
        key: isInward ? link.inwardIssue.key : link.outwardIssue.key,
        direction: isInward ? 'inward' : 'outward'
      };
    });
  }

  /**
   * Adds tickets to the global PBR queue with full JIRA details
   * @param ticketsToAdd - Array of tickets to add
   * @returns Promise resolving to the updated queue
   */
  public async addTicketsToGlobalPbrQueue(ticketsToAdd: JiraTicket[]): Promise<JiraTicket[]> {
    const ticketsWithDetails = await Promise.all(
      ticketsToAdd.map(async (ticket) => {
        try {
          const response = await axios.get(`${JIRA_BASE_URL}/issue/${ticket.key}`, {
            auth: jiraAuth,
            params: {
              fields: jiraConfig.fields.join(',')
            },
            timeout: JIRA_TIMEOUT
          });

          return this.transformJiraIssueToTicket(response.data);
        } catch (error) {
          console.error(`Failed to fetch details for ticket ${ticket.key}:`, error);
          return ticket; // Return original ticket if fetch fails
        }
      })
    );

    // Add new tickets to queue, avoiding duplicates
    const existingKeys = new Set(this.globalPbrQueue.map(t => t.key));
    const newTickets = ticketsWithDetails.filter(ticket => !existingKeys.has(ticket.key));
    
    this.globalPbrQueue.push(...newTickets);
    console.log(`Added ${newTickets.length} tickets to global PBR queue. Total: ${this.globalPbrQueue.length}`);
    
    return this.globalPbrQueue;
  }

  /**
   * Removes a ticket from the global PBR queue
   * @param ticketKeyToRemove - The ticket key to remove
   * @returns The updated queue
   */
  public removeTicketFromGlobalPbrQueue(ticketKeyToRemove: string): JiraTicket[] {
    this.globalPbrQueue = this.globalPbrQueue.filter(ticket => ticket.key !== ticketKeyToRemove);
    console.log(`Removed ticket ${ticketKeyToRemove} from global PBR queue. Remaining: ${this.globalPbrQueue.length}`);
    return this.globalPbrQueue;
  }

  /**
   * Clears the global PBR queue
   * @returns Empty array
   */
  public clearGlobalPbrQueue(): JiraTicket[] {
    this.globalPbrQueue = [];
    console.log('Global PBR queue cleared');
    return this.globalPbrQueue;
  }

  // --- Session Management ---

  /**
   * Creates a new planning poker session
   * @param hostName - The host's display name
   * @param hostWsId - The host's WebSocket ID
   * @returns The created session
   * @throws Error if user is already in a session
   */
  public createSession(hostName: string, hostWsId: string): PlanningPokerSession {
    this.ensureWebSocketService();
    
    const initialTickets = [...this.globalPbrQueue];
    console.log(`Creating session with ${initialTickets.length} initial tickets from PBR queue`);

    if (this.isUserInAnySession(hostWsId)) {
      console.warn(`User ${hostName} (${hostWsId}) attempted to create a session while already in one`);
      throw new Error('You are already in a session. Please leave the current session before creating a new one.');
    }

    const sessionId = this.generateSessionId();
    const host = this.createUser(hostWsId, hostName, true);

    const session: PlanningPokerSession = {
      id: sessionId,
      hostId: host.id,
      users: [host],
      tickets: initialTickets,
      currentTicketKey: initialTickets.length > 0 ? initialTickets[0].key : null,
      votingOpen: false,
      votesRevealed: false,
      discussionPhase: false,
      autoRevealEnabled: true,
      finalEstimations: {},
    };

    this.sessions.set(sessionId, session);
    console.log(`Planning Poker session created: ${sessionId} by host ${hostName} (${host.id})`);
    
    const hostState = this.getSessionStateForUser(session, host.id);
    if (hostState) {
      this.webSocketService.sendToSocket(host.id, 'sessionUpdated', hostState);
      this.webSocketService.joinRoom(host.id, sessionId);
    }
    return hostState!;
  }

  /**
   * Allows a user to join an existing session
   * @param sessionId - The session ID to join
   * @param userName - The user's display name
   * @param userWsId - The user's WebSocket ID
   * @returns The session state for the user, or null if session not found
   */
  public joinSession(sessionId: string, userName: string, userWsId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!session) {
      console.warn(`Attempted to join non-existent session: ${sessionId}`);
      return null;
    }

    if (session.users.some(u => u.id === userWsId)) {
      console.warn(`User ${userName} (${userWsId}) already in session ${sessionId}`);
      const userState = this.getSessionStateForUser(session, userWsId);
      if (userState) {
        this.webSocketService.sendToSocket(userWsId, 'sessionUpdated', userState);
        this.webSocketService.joinRoom(userWsId, sessionId);
      }
      return userState;
    }

    const newUser = this.createUser(userWsId, userName, false);
    session.users.push(newUser);
    
    this.updateAndBroadcastSession(sessionId);
    console.log(`User ${userName} (${userWsId}) joined session: ${sessionId}`);

    this.webSocketService.joinRoom(userWsId, sessionId);
    return this.getSessionStateForUser(session, newUser.id);
  }

  /**
   * Allows a user to leave a session
   * @param sessionId - The session ID to leave
   * @param userId - The user ID leaving
   * @returns true if successfully left, false otherwise
   */
  public leaveSession(sessionId: string, userId: string): boolean {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!session) {
      console.warn(`Attempt to leave non-existent session ${sessionId} by user ${userId}`);
      return false;
    }

    session.users = session.users.filter(u => u.id !== userId);
    
    if (session.users.length === 0) {
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} deleted as all users left`);
      return true;
    }

    // If host left, transfer host to first remaining user
    if (session.hostId === userId) {
      const newHost = session.users[0];
      session.hostId = newHost.id;
      newHost.isHost = true;
      console.log(`Host transferred to ${newHost.name} (${newHost.id}) in session ${sessionId}`);
    }

    this.updateAndBroadcastSession(sessionId);
    console.log(`User ${userId} left session ${sessionId}. Remaining users: ${session.users.length}`);
    return true;
  }

  // --- Voting Management ---

  /**
   * Starts voting on a ticket
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @param ticketKeyToStart - Optional ticket key to start voting on
   * @returns The updated session, or null if operation failed
   */
  public startVoting(sessionId: string, hostId: string, ticketKeyToStart?: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to start voting for session ${sessionId} by user ${hostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    const ticketKey = ticketKeyToStart || session.tickets[0]?.key;
    if (!ticketKey) {
      console.warn(`No tickets available for voting in session ${sessionId}`);
      return null;
    }

    session.currentTicketKey = ticketKey;
    session.votingOpen = true;
    session.votesRevealed = false;
    
    // Reset all user votes for the new voting round
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.updateAndBroadcastSession(sessionId);
    console.log(`Voting started for ticket ${ticketKey} in session ${sessionId}`);
    return this.getSessionStateForUser(session, hostId);
  }

  /**
   * Submits a vote for the current ticket
   * @param sessionId - The session ID
   * @param userId - The user's ID
   * @param voteValue - The vote value
   * @returns The updated session, or null if operation failed
   */
  public submitVote(sessionId: string, userId: string, voteValue: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, userId)) {
      console.warn(`Invalid attempt to submit vote for session ${sessionId} by user ${userId}. Not in session.`);
      return null;
    }

    if (!session || !session.votingOpen) {
      console.warn(`Cannot submit vote: session ${sessionId} not in voting state`);
      return null;
    }

    const user = session.users.find(u => u.id === userId);
    if (!user) return null;

    user.hasVoted = true;
    user.vote = voteValue;

    // Check if all participants have voted and auto-reveal is enabled
    if (session.autoRevealEnabled && this.allParticipantsVoted(session)) {
      console.log(`All participants voted, auto-revealing votes for session ${sessionId}`);
      this.autoRevealVotes(sessionId);
    } else {
      this.updateAndBroadcastSession(sessionId);
    }

    console.log(`Vote submitted by ${user.name} (${userId}): ${voteValue} for ticket ${session.currentTicketKey}`);
    return this.getSessionStateForUser(session, userId);
  }

  /**
   * Reveals all votes for the current ticket
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @returns The updated session, or null if operation failed
   */
  public revealVotes(sessionId: string, hostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true) || !session?.votingOpen) {
      console.warn(`Invalid attempt to reveal votes for session ${sessionId} by user ${hostId}. Not host or voting not open.`);
      return null;
    }

    session.votesRevealed = true;
    session.votingOpen = false;
    
    this.checkForConsensus(session);
    
    // If no consensus, enter discussion phase
    if (!session.finalEstimations[session.currentTicketKey!]) {
      session.discussionPhase = true;
      console.log(`No consensus reached for ticket ${session.currentTicketKey}, entering discussion phase`);
    }
    
    this.updateAndBroadcastSession(sessionId);
    console.log(`Votes revealed for ticket ${session.currentTicketKey} in session ${sessionId}`);
    return this.getSessionStateForUser(session, hostId);
  }

  /**
   * Checks if all participants have voted
   * @param session - The session to check
   * @returns true if all participants have voted
   */
  private allParticipantsVoted(session: PlanningPokerSession): boolean {
    return session.users.every(user => user.hasVoted);
  }

  /**
   * Automatically reveals votes when all participants have voted
   * @param sessionId - The session ID
   */
  private autoRevealVotes(sessionId: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;

    session.votesRevealed = true;
    session.votingOpen = false;
    
    this.checkForConsensus(session);
    
    // If no consensus, enter discussion phase
    if (!session.finalEstimations[session.currentTicketKey!]) {
      session.discussionPhase = true;
      console.log(`No consensus reached for ticket ${session.currentTicketKey}, entering discussion phase`);
    }
    
    this.updateAndBroadcastSession(sessionId);
    console.log(`Votes auto-revealed for ticket ${session.currentTicketKey} in session ${sessionId}`);
  }

  /**
   * Checks if there's consensus among votes and sets final estimation if so
   * @param session - The session to check for consensus
   */
  private checkForConsensus(session: PlanningPokerSession): void {
    if (!session.currentTicketKey) return;

    const validVotes = session.users
      .map(u => u.vote)
      .filter(vote => vote && vote !== 'No answer by host' && vote !== '?' && vote !== '☕');
    
    if (validVotes.length === 0) return;

    const uniqueVotes = new Set(validVotes);
    if (uniqueVotes.size === 1) {
      const consensusValue = validVotes[0];
      if (consensusValue) {
        session.finalEstimations[session.currentTicketKey] = consensusValue;
        session.discussionPhase = false; // Exit discussion phase if consensus reached
        console.log(`Consensus reached for ticket ${session.currentTicketKey}: ${consensusValue} story points`);
      }
    }
  }

  /**
   * Moves to the next ticket in the session
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @returns The updated session, or null if operation failed
   */
  public nextTicket(sessionId: string, hostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to move to next ticket for session ${sessionId} by user ${hostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    // Find the next ticket to vote on
    let nextTicketKey: string | null = null;
    
    if (!session.currentTicketKey) {
      // No current ticket, start with the first ticket
      nextTicketKey = session.tickets[0]?.key || null;
    } else {
      // Find the current ticket index and move to the next one
      const currentIndex = session.tickets.findIndex(ticket => ticket.key === session.currentTicketKey);
      if (currentIndex >= 0 && currentIndex < session.tickets.length - 1) {
        nextTicketKey = session.tickets[currentIndex + 1].key;
      } else if (currentIndex >= 0 && currentIndex === session.tickets.length - 1) {
        // We're at the last ticket, cycle back to the first one
        nextTicketKey = session.tickets[0]?.key || null;
      }
    }

    // Reset voting state
    session.votingOpen = false;
    session.votesRevealed = false;
    session.discussionPhase = false;
    session.currentTicketKey = nextTicketKey;
    
    // Reset all user votes
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.updateAndBroadcastSession(sessionId);
    console.log(`Moved to next ticket in session ${sessionId}: ${nextTicketKey || 'No tickets available'}`);
    return this.getSessionStateForUser(session, hostId);
  }

  // --- Session State Management ---

  /**
   * Clears all data from a session
   * @param sessionId - The session ID to clear
   * @param hostId - The host's user ID
   */
  public clearSession(sessionId: string, hostId: string): void {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to clear session ${sessionId} by user ${hostId}. Not host.`);
      return;
    }

    if (!session) return;

    session.tickets = [];
    session.currentTicketKey = null;
    session.votingOpen = false;
    session.votesRevealed = false;
    session.finalEstimations = {};
    
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.updateAndBroadcastSession(sessionId);
    console.log(`Session ${sessionId} cleared by host ${hostId}`);
  }

  /**
   * Gets a session by ID
   * @param sessionId - The session ID to retrieve
   * @returns The session if found, null otherwise
   */
  public getSession(sessionId: string): PlanningPokerSession | null {
    return this.findSession(sessionId);
  }

  /**
   * Broadcasts session updates to all participants
   * @param sessionId - The session ID to broadcast updates for
   */
  private broadcastSessionUpdate(sessionId: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;

    session.users.forEach(user => {
      const userState = this.getSessionStateForUser(session, user.id);
      if (userState) {
        this.webSocketService.sendToSocket(user.id, 'sessionUpdated', userState);
      }
    });
  }

  /**
   * Gets session state filtered for a specific user
   * @param session - The session to get state for
   * @param userId - The user ID to filter for
   * @returns The filtered session state, or null if user not found
   */
  public getSessionStateForUser(session: PlanningPokerSession, userId: string): PlanningPokerSession | null {
    const user = session.users.find(u => u.id === userId);
    if (!user) return null;

    // Create a copy of the session with user-specific data
    const userState: PlanningPokerSession = {
      ...session,
      users: session.users.map(u => ({
        ...u,
        // Only show votes if they've been revealed or if it's the user's own vote
        vote: session.votesRevealed || u.id === userId ? u.vote : null
      }))
    };

    return userState;
  }

  /**
   * Handles user disconnection
   * @param userId - The user ID that disconnected
   */
  public handleDisconnect(userId: string): void {
    // Find and remove user from all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.users.some(u => u.id === userId)) {
        this.leaveSession(sessionId, userId);
      }
    }
    console.log(`User ${userId} disconnected and removed from all sessions`);
  }

  /**
   * Transfers host role to another user
   * @param sessionId - The session ID
   * @param currentHostId - The current host's user ID
   * @param newHostId - The new host's user ID
   * @returns The updated session, or null if operation failed
   */
  public transferHost(sessionId: string, currentHostId: string, newHostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, currentHostId, true)) {
      console.warn(`Invalid attempt to transfer host for session ${sessionId} by user ${currentHostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    const newHost = session.users.find(u => u.id === newHostId);
    if (!newHost) {
      console.warn(`Cannot transfer host: user ${newHostId} not found in session ${sessionId}`);
      return null;
    }

    // Update host roles
    const currentHost = session.users.find(u => u.id === currentHostId);
    if (currentHost) currentHost.isHost = false;
    newHost.isHost = true;
    session.hostId = newHostId;

    this.updateAndBroadcastSession(sessionId);
    console.log(`Host transferred from ${currentHost?.name} to ${newHost.name} in session ${sessionId}`);
    return this.getSessionStateForUser(session, newHostId);
  }

  // --- Ticket Management ---

  /**
   * Adds a ticket to a session
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @param ticketKey - The ticket key to add
   * @returns Promise resolving to the updated session, or null if operation failed
   */
  public async addTicketToSession(sessionId: string, hostId: string, ticketKey: string): Promise<PlanningPokerSession | null> {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to add ticket for session ${sessionId} by user ${hostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    // Check if ticket is already in session
    if (session.tickets.some(t => t.key === ticketKey)) {
      console.warn(`Ticket ${ticketKey} already exists in session ${sessionId}`);
      return this.getSessionStateForUser(session, hostId);
    }

    try {
      // Fetch full ticket details from JIRA
      const response = await axios.get(`${JIRA_BASE_URL}/issue/${ticketKey}`, {
        auth: jiraAuth,
        params: {
          fields: jiraConfig.fields.join(',')
        },
        timeout: JIRA_TIMEOUT
      });

      const ticket = this.transformJiraIssueToTicket(response.data);
      session.tickets.push(ticket);

      this.updateAndBroadcastSession(sessionId);
      console.log(`Ticket ${ticketKey} added to session ${sessionId}`);
      return this.getSessionStateForUser(session, hostId);
    } catch (error) {
      console.error(`Failed to add ticket ${ticketKey} to session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Sets the final estimation for a ticket
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @param ticketKey - The ticket key
   * @param estimationValue - The final estimation value
   * @returns The updated session, or null if operation failed
   */
  public setFinalEstimation(sessionId: string, hostId: string, ticketKey: string, estimationValue: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to set final estimation for session ${sessionId} by user ${hostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    session.finalEstimations[ticketKey] = estimationValue;
    session.discussionPhase = false; // Exit discussion phase

    this.updateAndBroadcastSession(sessionId);
    console.log(`Final estimation set for ticket ${ticketKey} in session ${sessionId}: ${estimationValue}`);
    return this.getSessionStateForUser(session, hostId);
  }

  /**
   * Restarts voting for the current ticket (during discussion phase)
   * @param sessionId - The session ID
   * @param hostId - The host's user ID
   * @returns The updated session, or null if operation failed
   */
  public restartVoting(sessionId: string, hostId: string): PlanningPokerSession | null {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to restart voting for session ${sessionId} by user ${hostId}. Not host.`);
      return null;
    }

    if (!session) return null;

    // Reset voting state
    session.votingOpen = true;
    session.votesRevealed = false;
    session.discussionPhase = false;
    
    // Reset all user votes
    session.users.forEach(user => {
      user.hasVoted = false;
      user.vote = null;
    });

    this.updateAndBroadcastSession(sessionId);
    console.log(`Voting restarted for ticket ${session.currentTicketKey} in session ${sessionId}`);
    return this.getSessionStateForUser(session, hostId);
  }

  /**
   * Closes a session
   * @param sessionId - The session ID to close
   * @param hostId - The host's user ID
   * @returns true if successfully closed, false otherwise
   */
  public closeSession(sessionId: string, hostId: string): boolean {
    this.ensureWebSocketService();
    const session = this.findSession(sessionId);
    
    if (!this.validateSessionAccess(session, hostId, true)) {
      console.warn(`Invalid attempt to close session ${sessionId} by user ${hostId}. Not host.`);
      return false;
    }

    if (!session) return false;

    // Notify all users that session is terminated
    session.users.forEach(user => {
      this.webSocketService.sendToSocket(user.id, 'sessionTerminated', {
        sessionId,
        reason: 'Session closed by host'
      });
    });

    this.sessions.delete(sessionId);
    console.log(`Session ${sessionId} closed by host ${hostId}`);
    return true;
  }
}

// Export a singleton instance
export const planningPokerService = new PlanningPokerService();