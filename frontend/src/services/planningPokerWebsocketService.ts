import { Manager, Socket } from 'socket.io-client';
import {
  PlanningPokerSession,
  JiraTicket,
  ErrorPayload,
  SessionCreatedPayload,
  SessionTerminatedPayload,
} from '../types/planningPoker';

// Get WebSocket URL from environment variables. Vite uses VITE_ prefix.
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001';

console.log('[WebSocketService] Using WebSocket URL:', WEBSOCKET_URL);

export class PlanningPokerWebSocketService {
  private socket: any | null = null;
  private manager: any | null = null;

  private onSessionUpdateCallbacks: Array<(session: PlanningPokerSession) => void> = [];
  private onSessionTerminatedCallbacks: Array<(payload: SessionTerminatedPayload) => void> = [];
  private onQueueUpdateCallbacks: Array<(queue: JiraTicket[]) => void> = [];
  private onErrorCallbacks: Array<(error: ErrorPayload) => void> = [];
  private onConnectedCallbacks: Array<() => void> = [];
  private onDisconnectedCallbacks: Array<(reason: string) => void> = [];

  public connect(token?: string): void {
    if (this.socket?.connected) {
      console.log('[WebSocketService] Already connected.');
      return;
    }

    console.log('[WebSocketService] Attempting to connect...');
    
    this.manager = new Manager(WEBSOCKET_URL, {
        reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket'],
      path: '/socket.io',
    });

    // Connect with authentication if token is provided
    if (token) {
      this.socket = this.manager.socket('/', {
        auth: { token },
        extraHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    } else {
      this.socket = this.manager.socket('/');
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocketService] Connected successfully with socket ID:', this.socket?.id);
      this.onConnectedCallbacks.forEach(cb => cb());
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[WebSocketService] Disconnected:', reason);
      this.onDisconnectedCallbacks.forEach(cb => cb(reason));
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[WebSocketService] Connection Error:', error);
      this.onErrorCallbacks.forEach(cb => cb({ message: `Connection failed: ${error.message}` }));
    });

    // Custom application-level events
    this.socket.on('sessionUpdated', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Received sessionUpdated:', session);
      this.onSessionUpdateCallbacks.forEach(cb => cb(session));
    });

    this.socket.on('sessionCreated', (session: SessionCreatedPayload) => {
        console.log('[WebSocketService] Received sessionCreated:', session);
        this.onSessionUpdateCallbacks.forEach(cb => cb(session as PlanningPokerSession));
    });

    // Add support for backend event names
    this.socket.on('sessionJoined', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Received sessionJoined:', session);
      this.onSessionUpdateCallbacks.forEach(cb => cb(session));
    });
    this.socket.on('sessionUpdate', (session: PlanningPokerSession) => {
      console.log('[WebSocketService] Received sessionUpdate:', session);
      this.onSessionUpdateCallbacks.forEach(cb => cb(session));
    });

    this.socket.on('sessionTerminated', (payload: SessionTerminatedPayload) => {
      console.log('[WebSocketService] Received sessionTerminated:', payload);
      this.onSessionTerminatedCallbacks.forEach(cb => cb(payload));
    });

    this.socket.on('server.pbrQueue.updated', (queue: JiraTicket[]) => {
      console.log('[WebSocketService] Received server.pbrQueue.updated:', queue);
      this.onQueueUpdateCallbacks.forEach(cb => cb(queue));
    });

    this.socket.on('error', (error: ErrorPayload) => {
      console.error('[WebSocketService] Received error from server:', JSON.stringify(error, null, 2));
      this.onErrorCallbacks.forEach(cb => cb(error));
    });
  }

  // --- Public methods to subscribe to events ---

  public onConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
  }

  public onDisconnected(callback: (reason: string) => void): void {
    this.onDisconnectedCallbacks.push(callback);
  }

  public onError(callback: (error: ErrorPayload) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  public onSessionUpdate(callback: (session: PlanningPokerSession) => void): void {
    this.onSessionUpdateCallbacks.push(callback);
  }

  public onSessionTerminated(callback: (payload: SessionTerminatedPayload) => void): void {
    this.onSessionTerminatedCallbacks.push(callback);
  }

  public onQueueUpdate(callback: (queue: JiraTicket[]) => void): void {
    this.onQueueUpdateCallbacks.push(callback);
  }
  
  // --- Public methods to unsubscribe from events ---

  public offConnected(callback: () => void): void {
    this.onConnectedCallbacks = this.onConnectedCallbacks.filter(cb => cb !== callback);
  }

  public offDisconnected(callback: (reason: string) => void): void {
    this.onDisconnectedCallbacks = this.onDisconnectedCallbacks.filter(cb => cb !== callback);
  }

  public offError(callback: (error: ErrorPayload) => void): void {
    this.onErrorCallbacks = this.onErrorCallbacks.filter(cb => cb !== callback);
  }

  public offSessionUpdate(callback: (session: PlanningPokerSession) => void): void {
    this.onSessionUpdateCallbacks = this.onSessionUpdateCallbacks.filter(cb => cb !== callback);
  }

  public offSessionTerminated(callback: (payload: SessionTerminatedPayload) => void): void {
    this.onSessionTerminatedCallbacks = this.onSessionTerminatedCallbacks.filter(cb => cb !== callback);
  }

  public offQueueUpdate(callback: (queue: JiraTicket[]) => void): void {
    this.onQueueUpdateCallbacks = this.onQueueUpdateCallbacks.filter(cb => cb !== callback);
  }

  // --- Public methods to emit events to the server ---

  private emit(event: string, ...args: any[]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else {
      console.error(`[WebSocketService] Cannot emit event '${event}'. Socket not connected.`);
    }
  }

  public createSession(hostName: string): void {
    this.emit('createSession', { hostName });
  }

  public joinSession(sessionId: string, userName: string): void {
    this.emit('joinSession', { sessionId, userName });
  }

  public clearSession(sessionId: string): void {
    this.emit('clearSession', { sessionId });
  }

  public leaveSession(sessionId: string): void {
    this.emit('leaveSession', { sessionId });
  }

  public startVoting(sessionId: string, ticketKey?: string): void {
    this.emit('startVoting', { sessionId, ticketKey });
  }

  public submitVote(sessionId: string, vote: string): void {
    this.emit('submitVote', { sessionId, vote });
  }

  public revealVotes(sessionId: string): void {
    this.emit('revealVotes', { sessionId });
  }

  public nextTicket(sessionId: string): void {
    this.emit('nextTicket', { sessionId });
  }

  public addTicketToSession(sessionId: string, ticketKey: string): void {
    this.emit('addTicketToSession', { sessionId, ticketKey });
  }

  public setFinalEstimation(sessionId: string, ticketKey: string, estimationValue: string): void {
    this.emit('setFinalEstimation', { sessionId, ticketKey, estimationValue });
  }

  public restartVoting(sessionId: string): void {
    this.emit('restartVoting', { sessionId });
  }

  public addTicketsToQueue(tickets: {key: string}[]): void {
    this.emit('client.pbrQueue.add', { tickets });
  }

  public removeTicketFromQueue(ticketKey: string): void {
    this.emit('client.pbrQueue.remove', { ticketKey });
  }

  public clearQueue(): void {
    this.emit('client.pbrQueue.clear');
    }

  public transferHost(sessionId: string, newHostId: string): void {
    this.emit('transferHost', { sessionId, newHostId });
  }
  
  public closeSession(sessionId: string): void {
    this.emit('closeSession', { sessionId });
  }

  public disconnect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocketService] Disconnecting...');
      this.socket.disconnect();
    }
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
    }
}

// Export a singleton instance
const planningPokerWsService = new PlanningPokerWebSocketService();
export default planningPokerWsService;