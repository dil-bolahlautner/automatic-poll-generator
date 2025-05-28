import { Router } from 'express';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

const router = Router();

let client: Client | null = null;

const initializeClient = () => {
  if (!client) {
    const tenantId = process.env.TEAMS_TENANT_ID;
    const clientId = process.env.TEAMS_CLIENT_ID;
    const clientSecret = process.env.TEAMS_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Missing Teams credentials. Please check your .env file.');
    }

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(['https://graph.microsoft.com/.default']);
          return token.token;
        }
      }
    });
  }
  return client;
};

// Generate Teams polls from PBR page
router.post('/generate-polls', async (req, res) => {
  try {
    const { meetingId, tickets } = req.body;

    if (!meetingId || !tickets || !Array.isArray(tickets)) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const graphClient = initializeClient();

    // Delete existing polls
    const existingPolls = await graphClient
      .api(`/me/onlineMeetings/${meetingId}/polls`)
      .get();

    for (const poll of existingPolls.value) {
      await graphClient
        .api(`/me/onlineMeetings/${meetingId}/polls/${poll.id}`)
        .delete();
    }

    // Create new polls for each ticket
    const pollPromises = tickets.map(async (ticket: any) => {
      const poll = {
        title: `${ticket.key}: ${ticket.title}`,
        options: ['1', '2', '3', '5', '8', '13', '20', '?'],
        allowMultipleVotes: false,
        isAnonymous: false
      };

      return graphClient
        .api(`/me/onlineMeetings/${meetingId}/polls`)
        .post(poll);
    });

    const results = await Promise.all(pollPromises);
    res.json(results);
  } catch (error: any) {
    console.error('Error generating Teams polls:', error);
    res.status(500).json({ 
      error: 'Failed to generate Teams polls',
      message: error.message 
    });
  }
});

export const teamsRouter = router; 