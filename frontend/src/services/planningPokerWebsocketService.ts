import io from 'socket.io-client'; // Default import for the 'io' function
import * as SocketIOClient from 'socket.io-client'; // Import all as a namespace
import {
  PlanningPokerSession,
  JiraTicket,
  ErrorPayload,
  SessionUpdatedPayload,
  SessionCreatedPayload,
} from '../types/planningPoker';

type SessionUpdateCallback = (session: PlanningPokerSession) => void;
type ErrorCallback = (error: ErrorPayload) => void;

// Ensure WEBSOCKET_URL is just the base origin (e.g., http://localhost:3001)
let rawWebsocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
let websocketBaseOrigin = 'http://localhost:3001'; // Default

if (rawWebsocketUrl) {
  try {
    const parsedUrl = new URL(rawWebsocketUrl);
    websocketBaseOrigin = parsedUrl.origin; // Strictly use only the origin
    console.log(`Derived WebSocket base origin from REACT_APP_WEBSOCKET_URL: ${websocketBaseOrigin}`);
  } catch (e) {
    console.error(
      `Invalid REACT_APP_WEBSOCKET_URL ('${rawWebsocketUrl}'). Falling back to default origin '${websocketBaseOrigin}'. Error:`, e
    );
    // websocketBaseOrigin remains the default
  }
} else {
  console.log(`REACT_APP_WEBSOCKET_URL not set. Using default WebSocket origin: ${websocketBaseOrigin}`);
}

const WEBSOCKET_BASE_URL = websocketBaseOrigin;

class PlanningPokerWebsocketService {
  private socket: SocketIOClient.Socket | null = null; // Use the namespaced Socket type
  private onSessionUpdateCallback: SessionUpdateCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  public connect(
    onSessionUpdate: SessionUpdateCallback,
    onError: ErrorCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        console.log('PlanningPoker WS already connected.');
        resolve();
        return;
      }

      console.log(`Attempting to connect to Planning Poker WebSocket at origin ${WEBSOCKET_BASE_URL} with explicit path '/socket.io/'`);
      this.socket = io(WEBSOCKET_BASE_URL, { // Connect to the determined base origin
        path: '/socket.io/', // Explicitly set the standard Socket.IO path
        reconnectionAttempts: 5,
        timeout: 10000,
        transports: ['websocket', 'polling'] // Explicitly allow websocket first
      });

      this.onSessionUpdateCallback = onSessionUpdate;
      this.onErrorCallback = onError;

      this.socket.on('connect', () => {
        console.log('Planning Poker WebSocket connected successfully. Socket ID:', this.socket?.id);
        this.registerEventHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => { // Added type for error
        console.error('Planning Poker WebSocket connection error:', error);
        this.onErrorCallback && this.onErrorCallback({ message: 'Connection error: ' + error.message, details: error });
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => { // Changed type to string
        console.log('Planning Poker WebSocket disconnected:', reason);
        // Optionally notify UI about disconnection
        this.onErrorCallback && this.onErrorCallback({ message: 'Disconnected: ' + reason });
      });
    });
  }

  private registerEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('sessionCreated', (session: SessionCreatedPayload) => {
      console.log('Event: sessionCreated', session);
      this.onSessionUpdateCallback && this.onSessionUpdateCallback(session);
    });

    this.socket.on('sessionUpdated', (session: SessionUpdatedPayload) => {
      console.log('Event: sessionUpdated', session);
      this.onSessionUpdateCallback && this.onSessionUpdateCallback(session);
    });

    this.socket.on('error', (error: ErrorPayload) => {
      console.error('Event: error', error);
      this.onErrorCallback && this.onErrorCallback(error);
    });
  }

  public createSession(hostName: string, tickets: JiraTicket[]): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot create session.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot create session: Not connected' });
      return;
    }
    console.log('Emitting: createSession', { hostName, tickets });
    this.socket.emit('createSession', { hostName, tickets });
  }

  public joinSession(sessionId: string, userName: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot join session.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot join session: Not connected' });
      return;
    }
    console.log('Emitting: joinSession', { sessionId, userName });
    this.socket.emit('joinSession', { sessionId, userName });
  }

  public submitVote(sessionId: string, vote: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot submit vote.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot submit vote: Not connected' });
      return;
    }
    console.log('Emitting: submitVote', { sessionId, vote });
    this.socket.emit('submitVote', { sessionId, vote });
  }

  public revealVotes(sessionId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot reveal votes.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot reveal votes: Not connected' });
      return;
    }
    console.log('Emitting: revealVotes', { sessionId });
    this.socket.emit('revealVotes', { sessionId });
  }

  public startVoting(sessionId: string, ticketKey?: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot start voting.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot start voting: Not connected' });
      return;
    }
    console.log('Emitting: startVoting', { sessionId, ticketKey });
    this.socket.emit('startVoting', { sessionId, ticketKey });
  }
  
  public nextTicket(sessionId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot move to next ticket.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot move to next ticket: Not connected' });
      return;
    }
    console.log('Emitting: nextTicket', { sessionId });
    this.socket.emit('nextTicket', { sessionId });
  }

  public disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting Planning Poker WebSocket.');
      this.socket.disconnect();
      this.socket = null;
      this.onSessionUpdateCallback = null;
      this.onErrorCallback = null;
    }
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export const planningPokerWsService = new PlanningPokerWebsocketService();