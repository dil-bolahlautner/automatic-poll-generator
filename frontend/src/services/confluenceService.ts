import axios from 'axios';
import { JiraTicket } from './jiraService'; // Ensure this JiraTicket matches the one used in RetroPresentation
import { getAuthHeaders } from '../utils/authUtils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interfaces for Retro Demo Page generation payload
export interface RetroEpicWithTickets {
  epicKey: string;
  epicSummary: string;
  tickets: JiraTicket[]; // Assumes JiraTicket from jiraService is compatible
}

export interface RetroTopic {
  id: string;
  title: string;
  owner: string;
  epics: RetroEpicWithTickets[];
}

export interface RetroDemoPageResponse {
  message: string;
  confluenceViewUrl: string;
  pageId: string;
}

export interface ConfluenceTableRow {
  ticketToRefine: string;
  taskType: 'BACKEND' | 'FRONTEND' | '';
  description: string;
  reporter?: string;
  dependingOn: string[];
  linkedIssues: {
    key: string;
    type: string;
    direction: 'inward' | 'outward';
  }[];
  targetVersion: {
    value: string;
    isGreen: boolean;
  };
}

export const confluenceService = {
  async generateTable(pageUrl: string, tickets: JiraTicket[]): Promise<void> {
    console.log('Generating Confluence table with tickets:', tickets.map(t => ({
      key: t.key,
      blockingIssues: t.blockingIssues,
      linkedIssues: t.linkedIssues
    })));

    const tableRows = tickets.map(ticket => {
      // Calculate task type based on labels, with null check
      const taskType = (ticket.labels || []).some(label => 
        label.toLowerCase().includes('backend')
      ) ? 'BACKEND' : 
        (ticket.labels || []).some(label => 
          label.toLowerCase().includes('frontend')
        ) ? 'FRONTEND' : '';

      // Get blocking issues, with null check
      const blockingIssues = (ticket.blockingIssues || [])
        .map(issue => issue.key);

      // Get target version and determine if it should be green, with null check
      const targetVersion = ticket.fixVersions?.[0]?.name || '';
      const formattedVersion = targetVersion.startsWith('QST 4.') ? '4.0' :
                              targetVersion.startsWith('QST 3.') ? '3.x' :
                              targetVersion;
      const isGreen = formattedVersion === '4.0';

      return {
        ticketToRefine: `${ticket.key}: ${ticket.summary}`,
        taskType,
        description: ticket.summary,
        reporter: ticket.reporter,
        dependingOn: blockingIssues,
        linkedIssues: ticket.linkedIssues || [],
        targetVersion: {
          value: formattedVersion,
          isGreen
        }
      };
    });

    const response = await axios.post(`${API_BASE_URL}/api/confluence/table`, {
      pageUrl,
      tableRows
    }, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async generateRetroDemoPage(
    pageUrl: string,
    topicsData: RetroTopic[],
    sprintName: string
  ): Promise<RetroDemoPageResponse> {
    try {
      console.log('Frontend: Sending request to generate retro demo page:', { pageUrl, topicsData, sprintName });
      const response = await axios.post<RetroDemoPageResponse>(`${API_BASE_URL}/api/confluence/generate-retro-page`, {
        pageUrl,
        topicsData,
        sprintName
      }, {
        headers: getAuthHeaders()
      });
      console.log('Frontend: Received response from retro demo page generation:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Frontend: Error generating Confluence retro demo page:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      // Rethrow a more user-friendly error or the original error
      throw error.response?.data || error;
    }
  }
};