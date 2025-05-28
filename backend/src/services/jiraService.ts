/**
 * JIRA Service
 * 
 * Service responsible for interacting with the JIRA API, including:
 * - Fetching tickets and their details
 * - Managing fix versions
 * - Handling sprint information
 * - Processing ticket relationships and dependencies
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { jiraConfig } from '../config/jira';

dotenv.config();

// JIRA API configuration
const jiraHost = process.env.JIRA_HOST || 'https://diligentbrands.atlassian.net';
const jiraBaseUrl = `${jiraHost}/rest/api/2`;
const jiraAgileBaseUrl = `${jiraHost}/rest/agile/1.0`;

// Authentication configuration for JIRA API
const jiraAuth = {
  username: process.env.JIRA_USERNAME || '',
  password: process.env.JIRA_API_TOKEN || ''
};

/**
 * Interface representing a JIRA Sprint
 */
export interface Sprint {
  id: number;
  self: string;
  state: string; // e.g., 'active', 'closed', 'future'
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
  goal?: string;
}

/**
 * Interface representing a JIRA Fix Version
 */
export interface FixVersion {
  id: string;
  name: string;
  released: boolean;
}

/**
 * Interface representing a linked JIRA issue
 */
export interface LinkedIssue {
  key: string;
  type: string;
  direction: 'inward' | 'outward';
}

/**
 * Interface representing a JIRA ticket with all relevant fields
 */
export interface JiraTicket {
  key: string;
  summary: string;
  type: string;
  status: string;
  labels: string[];
  reporter?: string;
  assignee?: string;
  fixVersions: FixVersion[];
  linkedIssues: LinkedIssue[];
  blockingIssues: JiraTicket[];
  parent?: {
    key: string;
    summary: string;
  };
}

/**
 * JIRA Service implementation
 */
export const jiraService = {
  /**
   * Fetches all JIRA tickets based on the configured filter
   * Implements pagination to handle large result sets
   * @returns Object containing array of tickets and total count
   */
  async getTickets(): Promise<{ tickets: JiraTicket[], total: number }> {
    try {
      console.log('\n=== JIRA API CALL START ===');
      console.log('JQL Query:', jiraConfig.defaultFilter);
      console.log('JIRA Base URL:', jiraBaseUrl);
      console.log('Auth configured:', {
        host: process.env.JIRA_HOST,
        username: process.env.JIRA_USERNAME ? '***' : 'missing',
        token: process.env.JIRA_API_TOKEN ? '***' : 'missing'
      });
      
      let allIssues: any[] = [];
      let startAt = 0;
      const maxResults = 100; // JIRA's default page size
      const maxTotalResults = 10000; // Our maximum desired results
      let totalCount = 0;
      
      // Paginate through all results
      while (true) {
        console.log(`\nFetching page ${startAt / maxResults + 1}...`);
        try {
          const response = await axios.get(`${jiraBaseUrl}/search`, {
            auth: jiraAuth,
            params: {
              jql: jiraConfig.defaultFilter,
              fields: jiraConfig.fields.join(','),
              startAt,
              maxResults
            }
          });
          
          console.log('JIRA API Response:', {
            total: response.data.total,
            maxResults: response.data.maxResults,
            startAt: response.data.startAt,
            issuesCount: response.data.issues.length,
            responseKeys: Object.keys(response.data),
            firstIssue: response.data.issues[0] ? {
              key: response.data.issues[0].key,
              fields: Object.keys(response.data.issues[0].fields)
            } : null
          });

          // Store the total count from the first response
          if (startAt === 0) {
            totalCount = response.data.total;
          }

          allIssues = [...allIssues, ...response.data.issues];
          
          // Break if we've reached the end or our maximum desired results
          if (response.data.issues.length === 0 || allIssues.length >= maxTotalResults) {
            break;
          }
          
          startAt += maxResults;
        } catch (error: any) {
          console.error('\nError in JIRA API call:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
          });
          throw error;
        }
      }

      console.log('\nTotal issues collected:', allIssues.length);

      // Transform raw JIRA issues into our ticket format
      const transformedTickets = allIssues
        .map((issue: any) => {
          try {
            // Extract blocking issues (issues that block this ticket)
            const blockingIssues = (issue.fields.issuelinks || [])
              .filter((link: any) => {
                return link.type.name === 'Blocks' && link.outwardIssue;
              })
              .map((link: any) => ({
                key: link.outwardIssue.key,
                summary: link.outwardIssue.fields.summary,
                status: link.outwardIssue.fields.status.name,
                type: link.outwardIssue.fields.issuetype.name
              }));

            // Transform issue into our ticket format
            return {
              key: issue.key,
              summary: issue.fields.summary,
              type: issue.fields.issuetype.name,
              status: issue.fields.status.name,
              labels: issue.fields.labels || [],
              reporter: issue.fields.reporter?.displayName,
              fixVersions: (issue.fields.fixVersions || []).map((version: any) => ({
                id: version.id,
                name: version.name,
                released: version.released
              })),
              linkedIssues: (issue.fields.issuelinks || []).map((link: any) => {
                const isInward = !!link.inwardIssue;
                return {
                  type: isInward ? link.type.inward : link.type.outward,
                  key: isInward ? link.inwardIssue.key : link.outwardIssue.key,
                  direction: isInward ? 'inward' : 'outward'
                };
              }),
              blockingIssues: blockingIssues,
              parent: issue.fields.parent ? {
                key: issue.fields.parent.key,
                summary: issue.fields.parent.fields.summary
              } : undefined
            } as JiraTicket;
          } catch (error) {
            console.error('Error transforming issue:', issue.key, error);
            return null;
          }
        })
        .filter((ticket): ticket is JiraTicket => ticket !== null);

      console.log('\nTransformed response:', {
        ticketsCount: transformedTickets.length,
        total: totalCount,
        sampleTicket: transformedTickets[0]
      });

      console.log('=== JIRA API CALL END ===\n');

      return {
        tickets: transformedTickets,
        total: totalCount
      };
    } catch (error: any) {
      console.error('\n=== JIRA API ERROR ===');
      console.error('Error fetching JIRA tickets:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      console.error('=== JIRA API ERROR END ===\n');
      throw error;
    }
  },

  /**
   * Fetches all fix versions for the configured project
   * @returns Array of fix versions
   */
  async getFixVersions(): Promise<FixVersion[]> {
    try {
      const response = await axios.get(`${jiraBaseUrl}/project/QST/versions`, {
        auth: jiraAuth
      });
      return response.data.map((version: any) => ({
        id: version.id,
        name: version.name,
        released: version.released
      }));
    } catch (error) {
      console.error('Error fetching fix versions:', error);
      throw error;
    }
  },

  /**
   * Generates the URL for a JIRA ticket
   * @param key - The JIRA ticket key
   * @returns The full URL to the ticket
   */
  getTicketUrl(key: string): string {
    return `https://${process.env.JIRA_HOST}/browse/${key}`;
  },

  /**
   * Searches for sprints on a specific board
   * @param boardId - The JIRA board ID
   * @param nameQuery - Optional name filter for sprints
   * @returns Array of matching sprints
   */
  async searchSprints(boardId: string, nameQuery?: string): Promise<Sprint[]> {
    if (!boardId) {
      console.error('JIRA_BOARD_ID is not configured.');
      throw new Error('JIRA_BOARD_ID must be configured to search for sprints.');
    }
    try {
      console.log(`\n=== JIRA API CALL START (searchSprints for board ${boardId}) ===`);
      let allSprints: Sprint[] = [];
      let startAt = 0;
      let isLastPage = false;
      const maxResultsPerPage = 50; // Default for Jira, can be adjusted if API allows

      // Paginate through all sprints
      while (!isLastPage) {
        console.log(`Fetching sprints for board ${boardId}, page starting at ${startAt}`);
        const response = await axios.get(`${jiraAgileBaseUrl}/board/${boardId}/sprint`, {
          auth: jiraAuth,
          params: {
            state: 'active,future,closed', // Fetch all states
            startAt: startAt,
            maxResults: maxResultsPerPage
          }
        });

        // Transform sprint data
        const fetchedSprints: Sprint[] = response.data.values.map((sprint: any) => ({
          id: sprint.id,
          self: sprint.self,
          state: sprint.state,
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          completeDate: sprint.completeDate,
          originBoardId: sprint.originBoardId,
          goal: sprint.goal
        }));

        // Filter by name if query provided
        const filteredSprints = nameQuery
          ? fetchedSprints.filter(sprint => 
              sprint.name.toLowerCase().includes(nameQuery.toLowerCase()))
          : fetchedSprints;

        allSprints = [...allSprints, ...filteredSprints];

        // Check if we've reached the last page
        isLastPage = response.data.isLast;
        if (!isLastPage) {
          startAt += maxResultsPerPage;
        }
      }

      console.log(`Found ${allSprints.length} sprints`);
      console.log('=== JIRA API CALL END ===\n');

      return allSprints;
    } catch (error) {
      console.error('Error searching sprints:', error);
      throw error;
    }
  },

  /**
   * Fetches all tickets for a specific sprint
   * @param sprintId - The JIRA sprint ID
   * @returns Object containing array of tickets and total count
   */
  async getTicketsForSprint(sprintId: string): Promise<{ tickets: JiraTicket[], total: number }> {
    try {
      console.log(`\n=== JIRA API CALL START (getTicketsForSprint ${sprintId}) ===`);
      const response = await axios.get(`${jiraAgileBaseUrl}/sprint/${sprintId}/issue`, {
        auth: jiraAuth,
        params: {
          fields: jiraConfig.fields.join(',')
        }
      });

      const transformedTickets = response.data.issues.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        type: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        labels: issue.fields.labels || [],
        reporter: issue.fields.reporter?.displayName,
        fixVersions: (issue.fields.fixVersions || []).map((version: any) => ({
          id: version.id,
          name: version.name,
          released: version.released
        })),
        linkedIssues: (issue.fields.issuelinks || []).map((link: any) => {
          const isInward = !!link.inwardIssue;
          return {
            type: isInward ? link.type.inward : link.type.outward,
            key: isInward ? link.inwardIssue.key : link.outwardIssue.key,
            direction: isInward ? 'inward' : 'outward'
          };
        }),
        blockingIssues: (issue.fields.issuelinks || [])
          .filter((link: any) => link.type.name === 'Blocks' && link.outwardIssue)
          .map((link: any) => ({
            key: link.outwardIssue.key,
            summary: link.outwardIssue.fields.summary,
            status: link.outwardIssue.fields.status.name,
            type: link.outwardIssue.fields.issuetype.name
          })),
        parent: issue.fields.parent ? {
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields.summary
        } : undefined
      }));

      console.log(`Found ${transformedTickets.length} tickets in sprint`);
      console.log('=== JIRA API CALL END ===\n');

      return {
        tickets: transformedTickets,
        total: response.data.total
      };
    } catch (error) {
      console.error('Error fetching sprint tickets:', error);
      throw error;
    }
  }
};