import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { VotingMessage } from '../types/websocket';

interface Voter {
  id: string;
  isHost: boolean;
  vote?: number | '?';
}

interface VotingSession {
  ticketKey: string;
  isActive: boolean;
  voters: Map<string, Voter>;
}

class WebSocketService {
  private io: Server;
  private sessions: Map<string, VotingSession> = new Map();

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.handshake.query.userId as string;
      const isHost = socket.handshake.query.isHost === 'true';

      console.log(`User connected: ${userId} (${isHost ? 'Host' : 'Voter'})`);

      socket.on('voting-message', (message: VotingMessage) => {
        this.handleVotingMessage(socket, userId, isHost, message);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(userId);
      });
    });
  }

  private handleVotingMessage(socket: any, userId: string, isHost: boolean, message: VotingMessage) {
    switch (message.type) {
      case 'start':
        if (!isHost) return;
        this.startVotingSession(message.ticketKey!, userId);
        break;

      case 'vote':
        if (!message.ticketKey || !message.vote) return;
        this.handleVote(message.ticketKey, userId, message.vote);
        break;

      case 'close':
        if (!isHost || !message.ticketKey) return;
        this.closeVotingSession(message.ticketKey);
        break;

      case 'restart':
        if (!isHost || !message.ticketKey) return;
        this.restartVotingSession(message.ticketKey);
        break;
    }
  }

  private startVotingSession(ticketKey: string, hostId: string) {
    const session: VotingSession = {
      ticketKey,
      isActive: true,
      voters: new Map([[hostId, { id: hostId, isHost: true }]])
    };

    this.sessions.set(ticketKey, session);
    this.broadcastSessionUpdate(ticketKey);
  }

  private handleVote(ticketKey: string, voterId: string, vote: number | '?') {
    const session = this.sessions.get(ticketKey);
    if (!session || !session.isActive) return;

    const voter = session.voters.get(voterId);
    if (!voter) return;

    voter.vote = vote;
    this.broadcastSessionUpdate(ticketKey);
  }

  private closeVotingSession(ticketKey: string) {
    const session = this.sessions.get(ticketKey);
    if (!session) return;

    session.isActive = false;
    this.broadcastSessionUpdate(ticketKey);
  }

  private restartVotingSession(ticketKey: string) {
    const session = this.sessions.get(ticketKey);
    if (!session) return;

    session.isActive = true;
    session.voters.forEach(voter => {
      voter.vote = undefined;
    });
    this.broadcastSessionUpdate(ticketKey);
  }

  private handleDisconnect(userId: string) {
    this.sessions.forEach((session, ticketKey) => {
      session.voters.delete(userId);
      if (session.voters.size === 0) {
        this.sessions.delete(ticketKey);
      } else {
        this.broadcastSessionUpdate(ticketKey);
      }
    });
  }

  private broadcastSessionUpdate(ticketKey: string) {
    const session = this.sessions.get(ticketKey);
    if (!session) return;

    const voters = Array.from(session.voters.values());
    this.io.emit('voting-session-update', {
      ticketKey,
      isActive: session.isActive,
      voters
    });
  }
}

export default WebSocketService; 