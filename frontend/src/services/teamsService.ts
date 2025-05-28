import axios from 'axios';

class TeamsService {
  private baseUrl: string;

  constructor() {
    // In development, use the default URL
    this.baseUrl = 'http://localhost:3001';
    
    // In production, use the environment variable if available
    if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_API_URL) {
      this.baseUrl = process.env.REACT_APP_API_URL;
    }
  }

  async createPoll(title: string, question: string, options: string[]): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/teams/polls`, {
        title,
        question,
        options,
      });
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }
}

export const teamsService = new TeamsService(); 