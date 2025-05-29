import io from 'socket.io-client'; // Default import for the 'io' function
import * as SocketIOClient from 'socket.io-client'; // Import all as a namespace
import {
  PlanningPokerSession,
  JiraTicket,
  ErrorPayload,
  SessionUpdatedPayload,
  SessionCreatedPayload,
  SessionTerminatedPayload,
} from '../types/planningPoker';

type SessionUpdateCallback = (session: PlanningPokerSession) => void;
type SessionTerminatedCallback = (payload: SessionTerminatedPayload) => void;
type GlobalPbrQueueUpdateCallback = (queue: JiraTicket[]) => void;
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
  private onSessionTerminatedCallback: SessionTerminatedCallback | null = null;
  private onGlobalPbrQueueUpdateCallback: GlobalPbrQueueUpdateCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private connected = false;

  // Event handler registration methods
  public onSessionUpdate(callback: SessionUpdateCallback): void {
    this.onSessionUpdateCallback = callback;
  }

  public onSessionTerminated(callback: SessionTerminatedCallback): void {
    this.onSessionTerminatedCallback = callback;
  }

  public onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  public offSessionUpdate(callback: SessionUpdateCallback): void {
    if (this.onSessionUpdateCallback === callback) {
      this.onSessionUpdateCallback = null;
    }
  }

  public offSessionTerminated(callback: SessionTerminatedCallback): void {
    if (this.onSessionTerminatedCallback === callback) {
      this.onSessionTerminatedCallback = null;
    }
  }

  public offError(callback: ErrorCallback): void {
    if (this.onErrorCallback === callback) {
      this.onErrorCallback = null;
    }
  }

  public connect(
    onSessionUpdate: (session: PlanningPokerSession) => void,
    onSessionTerminated: (payload: SessionTerminatedPayload) => void,
    onQueueUpdate: (queue: JiraTicket[]) => void,
    onError: (error: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // If we have a socket but it's not connected, clean it up first
      if (this.socket && !this.socket.connected) {
        console.log('[WebSocketService] Found disconnected socket, cleaning up...');
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
        this.connected = false;
      }

      if (this.socket && this.socket.connected) {
        console.log('[WebSocketService] Already connected');
        // Update callbacks even if already connected
        this.onSessionUpdateCallback = onSessionUpdate;
        this.onSessionTerminatedCallback = onSessionTerminated;
        this.onGlobalPbrQueueUpdateCallback = onQueueUpdate;
        this.onErrorCallback = onError;
        resolve();
        return;
      }

      console.log('[WebSocketService] Connecting to WebSocket server...');
      this.socket = io(WEBSOCKET_BASE_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true // Ensure we get a fresh connection
      });

      // Store callbacks
      this.onSessionUpdateCallback = onSessionUpdate;
      this.onSessionTerminatedCallback = onSessionTerminated;
      this.onGlobalPbrQueueUpdateCallback = onQueueUpdate;
      this.onErrorCallback = onError;

      this.socket.on('connect', () => {
        console.log('[WebSocketService] Connected to WebSocket server');
        this.connected = true;
        this.setupEventHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('[WebSocketService] Connection error:', error);
        this.connected = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('[WebSocketService] Disconnected:', reason);
        this.connected = false;
        // Only attempt to reconnect if the disconnect wasn't intentional
        if (reason !== 'io client disconnect') {
          console.log('[WebSocketService] Attempting to reconnect...');
        }
      });
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Remove any existing handlers to prevent duplicates
    this.socket.removeAllListeners();

    this.socket.on('sessionCreated', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Session created:', session);
      this.onSessionUpdateCallback?.(session);
    });

    this.socket.on('sessionUpdate', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Received session update:', session);
      this.onSessionUpdateCallback?.(session);
    });

    this.socket.on('sessionUpdated', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Received session updated:', session);
      this.onSessionUpdateCallback?.(session);
    });

    this.socket.on('sessionTerminated', (payload: SessionTerminatedPayload) => {
      console.log('[WebSocketService] Session terminated:', payload);
      this.onSessionTerminatedCallback?.(payload);
    });

    this.socket.on('server.pbrQueue.updated', (queue: JiraTicket[]) => {
      console.log('[WebSocketService] Queue updated:', queue);
      this.onGlobalPbrQueueUpdateCallback?.(queue);
    });

    this.socket.on('error', (error: any) => {
      console.error('[WebSocketService] Error:', error);
      this.onErrorCallback?.(error);
    });

    // Handle both joinResponse and sessionJoined events
    this.socket.on('joinResponse', (response: { success: boolean; session?: PlanningPokerSession; error?: string }) => {
      console.log('[WebSocketService] Join response:', response);
      if (response.success && response.session) {
        this.onSessionUpdateCallback?.(response.session);
      } else {
        this.onErrorCallback?.({ message: response.error || 'Failed to join session' });
      }
    });

    this.socket.on('sessionJoined', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Session joined:', session);
      this.onSessionUpdateCallback?.(session);
    });
  }

  // --- Global PBR Queue Emitters ---
  public emitAddTicketsToGlobalQueue(tickets: JiraTicket[]): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot add tickets to global PBR queue.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot add to PBR queue: Not connected' });
      return;
    }
    console.log('[WebSocketService] Emitting: client.pbrQueue.add', { tickets });
    this.socket.emit('client.pbrQueue.add', { tickets });
  }

  public emitRemoveTicketFromGlobalQueue(ticketKey: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot remove ticket from global PBR queue.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot remove from PBR queue: Not connected' });
      return;
    }
    console.log('Emitting: client.pbrQueue.remove', { ticketKey });
    this.socket.emit('client.pbrQueue.remove', { ticketKey });
  }

  public emitClearGlobalPbrQueue(): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot clear global PBR queue.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot clear PBR queue: Not connected' });
      return;
    }
    console.log('Emitting: client.pbrQueue.clear');
    this.socket.emit('client.pbrQueue.clear');
  }

  // --- Session Emitters ---
  public createSession(hostName: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('[PlanningPokerWsService] Socket not connected. Cannot create session.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot create session: Not connected' });
      return;
    }
    console.log('[PlanningPokerWsService] Emitting: createSession', { hostName });
    this.socket.emit('createSession', { hostName });
  }

  public joinSession(sessionId: string, userName: string): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    console.log('[WebSocketService] Joining session:', { sessionId, userName });
    // Set loading state before emitting join event
    this.socket.emit('joinSession', { sessionId, userName });
  }

  public clearSession(sessionId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot clear session.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot clear session: Not connected' });
      return;
    }
    console.log('Emitting: clearSession', { sessionId });
    this.socket.emit('clearSession', { sessionId });
  }

  public leaveSession(sessionId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected. Cannot leave session.');
      this.onErrorCallback && this.onErrorCallback({ message: 'Cannot leave session: Not connected' });
      return;
    }
    console.log('Emitting: leaveSession', { sessionId });
    this.socket.emit('leaveSession', { sessionId });
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
    console.log('[WebSocketService] Emitting: startVoting', { sessionId, ticketKey });
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
      console.log('[WebSocketService] disconnect() method called. Socket ID was:', this.socket.id);
      // Remove all listeners before disconnecting
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      console.log('[WebSocketService] this.socket set to null in disconnect()');
      this.onSessionUpdateCallback = null;
      this.onSessionTerminatedCallback = null;
      this.onGlobalPbrQueueUpdateCallback = null;
      this.onErrorCallback = null;
      this.connected = false;
    }
  }

  public getSocketId(): string | undefined {
    // console.log('[PlanningPokerWsService] getSocketId() called. Socket exists:', !!this.socket, 'ID:', this.socket?.id);
    return this.socket?.id;
  }

  public isConnected(): boolean {
    const connected = !!(this.socket && this.socket.connected);
    //console.log('[WebSocketService] isConnected() called. Socket exists:', !!this.socket, 'Connected status:', this.socket?.connected, 'Result:', connected);
    return connected;
  }
}

export const planningPokerWsService = new PlanningPokerWebsocketService();