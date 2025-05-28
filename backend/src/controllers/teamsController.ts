import { Request, Response } from 'express';
import { teamsService } from '../services/teamsService';

export const teamsController = {
  async createPoll(req: Request, res: Response) {
    try {
      const { title, question, options } = req.body;

      if (!title || !question || !options || !Array.isArray(options)) {
        return res.status(400).json({ 
          message: 'Missing required fields: title, question, and options array are required' 
        });
      }

      await teamsService.createPoll(title, question, options);
      res.status(201).json({ message: 'Poll created successfully' });
    } catch (error: any) {
      console.error('Error creating poll:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to create poll' 
      });
    }
  }
}; 