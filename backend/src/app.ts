import express from 'express';
import cors from 'cors';
import { jiraRouter } from './routes/jira';
import confluenceRoutes from './routes/confluence';
import teamsRoutes from './routes/teamsRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/jira', jiraRouter);
app.use('/api/confluence', confluenceRoutes);
app.use('/api/teams', teamsRoutes);

export default app; 