/**
 * Main server file for the Planning Poker application
 * Handles HTTP and WebSocket connections, routes, and core application setup
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
// import { Server } from 'socket.io'; // Will be handled by WebSocketService
import { jiraRouter } from './routes/jira';
import confluenceRoutes from './routes/confluence';
import { teamsRouter } from './routes/teams';
// import { v4 as uuidv4 } from 'uuid'; // Likely not needed here anymore if old WS logic is removed

// Import new services
import WebSocketService from './services/websocketService';
import { planningPokerService } from './services/planningPokerService';

// Load environment variables from .env file
console.log('Loading environment variables...');
dotenv.config();

// Debug: Log environment variables (safely)
console.log('Environment Variables:');
console.log('PORT:', process.env.PORT);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('JIRA_HOST:', process.env.JIRA_HOST);
console.log('CONFLUENCE_HOST:', process.env.CONFLUENCE_HOST);
console.log('AZURE_TENANT_ID:', process.env.AZURE_TENANT_ID);

try {
  // Initialize Express application and HTTP server
  console.log('Initializing Express application...');
  const app = express();
  const httpServer = createServer(app);

  // Configure middleware
  console.log('Configuring middleware...');
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }));
  app.use(express.json());

  // Register API routes
  console.log('Registering API routes...');
  app.use('/api/jira', jiraRouter);
  app.use('/api/confluence', confluenceRoutes);
  app.use('/api/teams', teamsRouter);

  // Initialize and wire up Planning Poker services
  console.log('Initializing WebSocket service...');
  const wsService = new WebSocketService(httpServer, planningPokerService);
  planningPokerService.setWebSocketService(wsService);

  // Start the server
  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// --- OLD WebSocket Logic (Commented out as new system should replace it for Planning Poker) ---
/*
// Create Socket.IO server with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  path: '/ws/estimation' // This path might be for the old system
});

console.log('Old WebSocket server initialized with path:', '/ws/estimation');

// In-memory storage for connected users and events
const connectedUsers = new Map<string, { name: string; isHost: boolean }>();
const events = new Map<string, {
  id: string;
  name: string;
  hostId: string;
  status: 'active' | 'completed';
  createdAt: string;
  currentTicketIndex: number;
  tickets: Array<{
    key: string;
    summary: string;
    description?: string;
    votes: Record<string, number | '?'>;
    status: 'pending' | 'voting' | 'closed';
    result?: {
      average: number;
      median: number;
      mode: number;
    };
  }>;
  participants: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
}>();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New client connected to OLD WS:', socket.id);
  console.log('Auth data (OLD WS):', socket.handshake.auth);
  
  let userId: string | null = null;

  // Handle user registration
  socket.on('register', (data: { userId: string; name: string; isHost: boolean }, callback) => {
    console.log('OLD WS Registration attempt:', data);
    const { userId: newUserId, name, isHost } = data;
    
    // Check if username is already taken
    const isNameTaken = Array.from(connectedUsers.values()).some(
      user => user.name.toLowerCase() === name.toLowerCase()
    );

    if (isNameTaken) {
      console.log('OLD WS Registration failed: Name taken');
      socket.emit('REGISTRATION_ERROR', {
        type: 'REGISTRATION_ERROR',
        payload: {
          error: 'This name is already taken. Please choose another one.'
        }
      });
      callback({ error: 'This name is already taken. Please choose another one.' });
      return;
    }

    // Register user if name is available
    userId = newUserId;
    if (userId) {
      console.log('OLD WS User registered successfully:', { userId, name, isHost });
      connectedUsers.set(userId, { name, isHost });
      socket.data = { userId, name, isHost };
      callback({ success: true });
    } else {
      console.log('OLD WS Registration failed: Invalid user ID');
      callback({ error: 'Failed to register user' });
    }
  });

  // Handle event creation
  socket.on('create_event', (data: { name: string; hostId: string }) => {
    console.log('OLD WS Received create_event request:', data);
    if (!userId || !socket.data) {
      console.error('OLD WS Create event failed: No user ID or socket data');
      return;
    }

    const eventId = uuidv4();
    const event = {
      id: eventId,
      name: data.name,
      hostId: data.hostId,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      currentTicketIndex: 0,
      tickets: [],
      participants: [{
        id: userId,
        name: socket.data.name,
        isHost: true
      }]
    };

    events.set(eventId, event);
    socket.join(eventId);
    socket.emit('EVENT_CREATED', { type: 'EVENT_CREATED', payload: { event, eventId } });
  });

  // Handle event joining
  socket.on('join_event', (data: { eventId: string; userId: string }) => {
    if (!userId || !socket.data) return;
    const event = events.get(data.eventId);
    if (!event) {
      socket.emit('error', { message: 'Event not found (OLD WS)' });
      return;
    }
    const participant = { id: userId, name: socket.data.name, isHost: false };
    event.participants.push(participant);
    socket.join(data.eventId);
    io.to(data.eventId).emit('event_updated', { event });
    io.to(data.eventId).emit('voter_joined', { voter: participant });
  });

  // Handle event leaving
  socket.on('leave_event', (data: { eventId: string; userId: string }) => {
    if (!userId) return;
    const event = events.get(data.eventId);
    if (!event) return;
    event.participants = event.participants.filter(p => p.id !== userId);
    socket.leave(data.eventId);
    if (event.participants.length === 0) {
      events.delete(data.eventId);
    } else {
      io.to(data.eventId).emit('event_updated', { event });
    }
    io.to(data.eventId).emit('voter_left', { voterId: userId });
  });

  // Handle voting start
  socket.on('start_voting', (data: { eventId: string; ticketKey: string }) => {
    if (!userId) return;
    const event = events.get(data.eventId);
    if (!event || event.hostId !== userId) return;
    const ticket = event.tickets.find(t => t.key === data.ticketKey);
    if (ticket) {
      ticket.status = 'voting';
      io.to(data.eventId).emit('voting_started', { event, ticketKey: data.ticketKey });
    }
  });

  // Handle vote submission
  socket.on('vote', (data: { eventId: string; ticketKey: string; vote: number | '?' }) => {
    if (!userId || !socket.data) return;
    const event = events.get(data.eventId);
    if (!event) return;
    const ticket = event.tickets.find(t => t.key === data.ticketKey);
    if (ticket && ticket.status === 'voting') {
      ticket.votes[userId] = data.vote;
      io.to(data.eventId).emit('vote_received', { event, ticketKey: data.ticketKey, userId, vote: data.vote });
    }
  });

  // Handle voting closure and result calculation
  socket.on('close_voting', (data: { eventId: string; ticketKey: string }) => {
    if (!userId) return;
    const event = events.get(data.eventId);
    if (!event || event.hostId !== userId) return;
    const ticket = event.tickets.find(t => t.key === data.ticketKey);
    if (ticket && ticket.status === 'voting') {
      ticket.status = 'closed';
      const votes = Object.values(ticket.votes).filter(v => typeof v === 'number') as number[];
      if (votes.length > 0) {
        // Calculate voting statistics
        const average = votes.reduce((a, b) => a + b, 0) / votes.length;
        const sorted = [...votes].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
        const counts = new Map<number, number>();
        votes.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        const mode = Array.from(counts.entries()).reduce((a, b) => b[1] > a[1] ? b : a)[0];
        ticket.result = { average, median, mode };
      }
      io.to(data.eventId).emit('voting_closed', { event, ticketKey: data.ticketKey, result: ticket.result });
    }
  });

  // Handle voting restart
  socket.on('restart_voting', (data: { eventId: string; ticketKey: string }) => {
    if (!userId) return;
    const event = events.get(data.eventId);
    if (!event || event.hostId !== userId) return;
    const ticket = event.tickets.find(t => t.key === data.ticketKey);
    if (ticket) {
      ticket.status = 'voting';
      ticket.votes = {};
      delete ticket.result;
      io.to(data.eventId).emit('voting_restarted', { event, ticketKey: data.ticketKey });
    }
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    if (userId) {
      connectedUsers.delete(userId);
      events.forEach((event, eventId) => {
        if (event.participants.some(p => p.id === userId)) {
          event.participants = event.participants.filter(p => p.id !== userId);
          if (event.participants.length === 0) {
            events.delete(eventId);
          } else {
            io.to(eventId).emit('event_updated', { event });
          }
          io.to(eventId).emit('voter_left', { voterId: userId });
        }
      });
    }
    console.log('Client disconnected from OLD WS:', socket.id);
  });
});
*/
// --- End of OLD WebSocket Logic --- 