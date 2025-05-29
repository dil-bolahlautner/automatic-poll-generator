import 'dotenv/config';
import http from 'http'; // Import http module
import express from 'express';
import cors from 'cors';

/*import dotenv from 'dotenv';
dotenv.config();*/

import { jiraRouter } from './routes/jira';
import { teamsRouter } from './routes/teams';
import { errorHandler } from './middleware/errorHandler';
import confluenceRoutes from './routes/confluence';
import WebSocketService from './services/websocketService'; // Import WebSocketService
import { planningPokerService } from './services/planningPokerService'; // Import planningPokerService singleton

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/jira', jiraRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/confluence', confluenceRoutes);

// Error handling
app.use(errorHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server and integrate WebSocketService
const httpServer = http.createServer(app);
const wsService = new WebSocketService(httpServer, planningPokerService);
planningPokerService.setWebSocketService(wsService); // Inject WebSocketService into PlanningPokerService

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`WebSocket server initialized and attached to HTTP server.`);
});