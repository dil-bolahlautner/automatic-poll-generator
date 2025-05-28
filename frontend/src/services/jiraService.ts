import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  type: string;
  labels: string[];
  reporter?: string;
  assignee?: string; // Added assignee
  parent?: {
    key: string;
    summary: string;
    type?: string; // Added to include parent issue type
  };
  fixVersions: {
    id: string;
    name: string;
    released: boolean;
  }[];
  linkedIssues: {
    type: string;
    key: string;
    direction: 'inward' | 'outward';
  }[];
  blockingIssues: {
    key: string;
    summary: string;
    status: string;
    type: string;
  }[];
}

export interface FixVersion {
  id: string;
  name: string;
  released: boolean;
}

export interface JiraResponse {
  tickets: JiraTicket[];
  total: number;
}

export interface Sprint {
  id: number;
  self: string;
  state: string;
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
  goal?: string;
}

export const jiraService = {
  async getTickets(): Promise<JiraResponse> {
    console.log('Frontend: Making JIRA tickets request to:', `${API_BASE_URL}/jira/tickets`);
    try {
      const response = await axios.get(`${API_BASE_URL}/jira/tickets`);
      console.log('Frontend: Raw JIRA response:', response.data);
      
      // Validate response structure
      if (!response.data) {
        throw new Error('Empty response received from server');
      }
      
      if (!Array.isArray(response.data.tickets)) {
        console.error('Invalid response structure:', response.data);
        throw new Error('Invalid response structure: tickets array is missing or invalid');
      }
      
      if (typeof response.data.total !== 'number') {
        console.error('Invalid response structure:', response.data);
        throw new Error('Invalid response structure: total count is missing or invalid');
      }

      console.log('Frontend: Received JIRA response:', {
        ticketsCount: response.data.tickets.length,
        total: response.data.total,
        firstTicket: response.data.tickets[0]
      });
      
      return {
        tickets: response.data.tickets,
        total: response.data.total
      };
    } catch (error: any) {
      console.error('Frontend: Error fetching JIRA tickets:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      throw error;
    }
  },

  async getFixVersions(): Promise<FixVersion[]> {
    console.log('Frontend: Making fix versions request to:', `${API_BASE_URL}/jira/fix-versions`);
    try {
      const response = await axios.get(`${API_BASE_URL}/jira/fix-versions`);
      console.log('Frontend: Received fix versions response:', {
        versionsCount: response.data.length
      });
      return response.data;
    } catch (error: any) {
      console.error('Frontend: Error fetching fix versions:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  },

  getTicketUrl(ticketKey: string): string {
    const host = process.env.REACT_APP_JIRA_HOST;
    if (!host) {
      console.error('REACT_APP_JIRA_HOST environment variable is not set');
      return `#${ticketKey}`;
    }
    return `https://${host}/browse/${ticketKey}`;
  },

  async searchSprints(nameQuery?: string): Promise<Sprint[]> {
    const params = new URLSearchParams();
    if (nameQuery) {
      params.append('name', nameQuery);
    }
    const url = `${API_BASE_URL}/jira/sprints/search?${params.toString()}`;
    console.log('Frontend: Making JIRA sprints search request to:', url);
    try {
      const response = await axios.get<Sprint[]>(url);
      console.log('Frontend: Received JIRA sprints response:', {
        sprintsCount: response.data.length,
        firstSprint: response.data[0]
      });
      return response.data;
    } catch (error: any) {
      console.error('Frontend: Error fetching JIRA sprints:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: url
      });
      // Check if the error is due to JIRA_BOARD_ID not being configured
      if (error.response?.data?.message?.includes('JIRA_BOARD_ID is not configured')) {
        // You might want to throw a specific error or handle this more gracefully in the UI
        throw new Error('JIRA Board ID is not configured on the server. Please contact an administrator.');
      }
      throw error;
    }
  },

  async getTicketsForSprint(sprintId: string): Promise<JiraResponse> {
    const url = `${API_BASE_URL}/jira/sprints/${sprintId}/tickets`;
    console.log('Frontend: Making JIRA sprint tickets request to:', url);
    try {
      const response = await axios.get<JiraResponse>(url);
      console.log('Frontend: Raw JIRA sprint tickets response:', response.data);

      if (!response.data || !Array.isArray(response.data.tickets) || typeof response.data.total !== 'number') {
        console.error('Invalid response structure for sprint tickets:', response.data);
        throw new Error('Invalid response structure from server for sprint tickets');
      }

      console.log('Frontend: Received JIRA sprint tickets response:', {
        ticketsCount: response.data.tickets.length,
        total: response.data.total,
        firstTicket: response.data.tickets[0]
      });
      return response.data;
    } catch (error: any) {
      console.error('Frontend: Error fetching JIRA sprint tickets:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: url
      });
      throw error;
    }
  }
};