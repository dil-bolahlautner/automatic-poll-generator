import { Router } from 'express';
import { teamsService } from '../services/teamsService';

const router = Router();

router.post('/polls', async (req, res) => {
  try {
    const { title, question, options } = req.body;
    await teamsService.createPoll(title, question, options);
    res.status(201).json({ message: 'Poll created successfully' });
  } catch (error: any) {
    console.error('Error creating Teams poll:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to create Teams poll' 
    });
  }
});

export default router; 