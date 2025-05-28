import { Router } from 'express';
import axios, { AxiosBasicCredentials } from 'axios';
import { confluenceConfig } from '../config/confluence';
import { getConfluenceService, FrontendTopic } from '../services/confluenceService'; // Added FrontendTopic
import { JiraTicket } from '../services/jiraService';

interface ConfluenceError extends Error {
  statusCode?: number;
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface TicketRelationship {
  key: string;
  type: 'blocks' | 'isBlockedBy';
}

interface TableRow {
  ticketToRefine: string;
  taskType: string;
  description: string;
  dependingOn: string[];
  targetVersion: {
    value: string;
    isGreen: boolean;
  };
  linkedIssues?: string[];
  reporter?: string;
}

interface ConfluencePage {
  version: {
    number: number;
  };
  title: string;
  body: {
    storage: {
      value: string;
    };
  };
}

interface FixVersion {
  id: string;
  name: string;
  released: boolean;
}

interface LinkedIssue {
  key: string;
  type: string;
  direction: 'inward' | 'outward';
}

const router = Router();

function isValidCredentials(username: string | undefined, password: string | undefined): username is string {
  return typeof username === 'string' && typeof password === 'string';
}

// Get PBR meeting notes
router.get('/pbr-notes', async (req, res) => {
  try {
    const { spaceKey, pageId } = req.query;

    if (!spaceKey || !pageId) {
      return res.status(400).json({ 
        error: 'Both spaceKey and pageId parameters are required' 
      });
    }

    const baseUrl = process.env.CONFLUENCE_HOST || 'https://diligentbrands.atlassian.net/wiki';
    const username = process.env.CONFLUENCE_USERNAME;
    const password = process.env.CONFLUENCE_API_TOKEN;

    if (!username || !password) {
      return res.status(500).json({ 
        message: 'Confluence credentials not configured. Please check your .env file.',
        details: 'Missing CONFLUENCE_USERNAME or CONFLUENCE_API_TOKEN'
      });
    }

    const auth = {
      username,
      password
    } as const;

    const content = await axios.get(`${baseUrl}/rest/api/content/${spaceKey}/${pageId}`, {
      auth: auth as unknown as AxiosBasicCredentials,
      params: {
        expand: 'body.storage,version'
      }
    });
    res.json(content.data);
  } catch (error: any) {
    console.error('Error fetching Confluence content:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Confluence content',
      message: error.message 
    });
  }
});

// Generate a table on a Confluence page
router.post('/table', async (req, res) => {
  try {
    const { pageUrl, tableRows } = req.body;
    console.log('Received tableRows:', tableRows);
    
    if (!pageUrl) {
      return res.status(400).json({ message: 'Confluence page URL is required' });
    }

    if (!tableRows || !Array.isArray(tableRows) || tableRows.length === 0) {
      return res.status(400).json({ message: 'At least one ticket is required' });
    }

    // Convert tableRows to tickets format with proper typing
    const tickets: JiraTicket[] = tableRows.map(row => {
      console.log('Processing row:', row);
      const [key, summary] = row.ticketToRefine.split(': ');
      console.log('Extracted key:', key, 'summary:', summary);
      console.log('dependingOn:', row.dependingOn);
      console.log('linkedIssues:', row.linkedIssues);
      
      const ticket = {
        key,
        summary: row.description,
        type: row.taskType,
        status: '',
        labels: [],
        reporter: row.reporter,
        fixVersions: [{
          id: '',
          name: row.targetVersion.value,
          released: false
        }],
        blockingIssues: row.dependingOn.map((key: string) => ({
          key,
          summary: '',
          status: '',
          type: ''
        })),
        linkedIssues: row.linkedIssues || []
      };
      console.log('Created ticket:', ticket);
      return ticket;
    });

    console.log('Final tickets array:', tickets);
    await getConfluenceService().generateTable(pageUrl, tickets);
    res.json({ message: 'Table generated successfully' });
  } catch (error: any) {
    console.error('Error generating Confluence table:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to generate Confluence table'
    });
  }
});

// Generate Retro Demo Page
router.post('/generate-retro-page', async (req, res) => {
  try {
    const { pageUrl, topicsData, sprintName } = req.body;

    if (!pageUrl) {
      return res.status(400).json({ message: 'Target Confluence page URL (pageUrl) is required.' });
    }
    if (!sprintName || typeof sprintName !== 'string' || sprintName.trim() === '') {
      return res.status(400).json({ message: 'Sprint name (sprintName) is required.' });
    }
    if (!topicsData || !Array.isArray(topicsData)) { // Basic check, could add more detailed validation
      return res.status(400).json({ message: 'Topics data (topicsData) is required and must be an array.' });
    }

    console.log(`Received request to generate retro demo page for URL: ${pageUrl}, Sprint: ${sprintName}`);
    
    const confluenceService = getConfluenceService();
    const result = await confluenceService.generateRetroDemoPage(pageUrl, topicsData as FrontendTopic[], sprintName);

    res.json({
      message: `Successfully generated retro demo content on Confluence page: ${result.pageTitle}`,
      confluenceViewUrl: result.confluenceViewUrl,
      pageId: result.pageId
    });

  } catch (error: any) {
    console.error('Error generating Confluence retro demo page:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to generate Confluence retro demo page'
    });
  }
});

export default router;