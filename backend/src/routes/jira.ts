import { Router } from 'express';
import { jiraService } from '../services/jiraService';

const router = Router();

/** GET /api/jira/tickets */
router.get('/tickets', async (_req, res, next) => {
  try {
    const result = await jiraService.getTickets();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/jira/fix-versions */
router.get('/fix-versions', async (_req, res, next) => {
  try {
    const result = await jiraService.getFixVersions();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/jira/sprints/search?name=[query] */
router.get('/sprints/search', async (req, res, next) => {
  try {
    const boardId = process.env.JIRA_BOARD_ID;
    if (!boardId) {
      // Log the error server-side for easier debugging
      console.error('JIRA_BOARD_ID environment variable is not set.');
      // Return a user-friendly error message
      return res.status(500).json({ message: 'JIRA_BOARD_ID is not configured on the server.' });
    }
    const nameQuery = req.query.name as string | undefined;
    const result = await jiraService.searchSprints(boardId, nameQuery);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/jira/sprints/:sprintId/tickets */
router.get('/sprints/:sprintId/tickets', async (req, res, next) => {
  try {
    const sprintId = req.params.sprintId;
    if (!sprintId) {
      return res.status(400).json({ message: 'Sprint ID is required.' });
    }
    const result = await jiraService.getTicketsForSprint(sprintId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const jiraRouter = router;