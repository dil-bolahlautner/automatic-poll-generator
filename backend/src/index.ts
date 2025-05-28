import 'dotenv/config';

import express from 'express';
import cors from 'cors';

/*import dotenv from 'dotenv';
dotenv.config();*/

import { jiraRouter } from './routes/jira';
import { teamsRouter } from './routes/teams';
import { errorHandler } from './middleware/errorHandler';
import confluenceRoutes from './routes/confluence';

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 