import axios from 'axios';
import dotenv from 'dotenv';
import { jiraConfig } from '../config/jira';

dotenv.config();

// Ensure the base URL is properly formatted
const jiraHost = process.env.JIRA_HOST || 'https://diligentbrands.atlassian.net';
const jiraBaseUrl = `${jiraHost}/rest/api/2`;
const jiraAgileBaseUrl = `${jiraHost}/rest/agile/1.0`;

const jiraAuth = {
  username: process.env.JIRA_USERNAME || '',
  password: process.env.JIRA_API_TOKEN || ''
};

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

export interface FixVersion {
  id: string;
  name: string;
  released: boolean;
}

export interface LinkedIssue {
  key: string;
  type: string;
  direction: 'inward' | 'outward';
}

export interface JiraTicket {
  key: string;
  summary: string;
  type: string;
  status: string;
  labels: string[];
  reporter?: string;
  assignee?: string; // Added assignee
  fixVersions: FixVersion[];
  linkedIssues: LinkedIssue[];
  blockingIssues: JiraTicket[];
  parent?: {
    key: string;
    summary: string;
  };
}

export const jiraService = {
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

      const transformedTickets = allIssues
        .map((issue: any) => {
          try {
            // Get blocking issues (issues that block this ticket)
            const blockingIssues = (issue.fields.issuelinks || [])
              .filter((link: any) => {
                // Check if this is a "blocks" link where this ticket is the outward issue
                return link.type.name === 'Blocks' && link.outwardIssue;
              })
              .map((link: any) => ({
                key: link.outwardIssue.key,
                summary: link.outwardIssue.fields.summary,
                status: link.outwardIssue.fields.status.name,
                type: link.outwardIssue.fields.issuetype.name
              }));

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

  getTicketUrl(key: string): string {
    return `https://${process.env.JIRA_HOST}/browse/${key}`;
  },

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
        
        allSprints = allSprints.concat(fetchedSprints);
        isLastPage = response.data.isLast;

        if (!isLastPage) {
          // Jira's `startAt` is the index of the first item.
          // If `maxResults` is 50 and `startAt` was 0, next `startAt` is 50.
          // If `response.data.values.length` is less than `maxResults`, it's also the last page,
          // but `isLast` should correctly indicate this.
          startAt = response.data.startAt + response.data.values.length;
        }
        console.log(`Fetched ${fetchedSprints.length} sprints. Total collected: ${allSprints.length}. Is last page: ${isLastPage}`);
      }

      if (nameQuery) {
        allSprints = allSprints.filter(sprint => sprint.name.toLowerCase().includes(nameQuery.toLowerCase()));
      }
      
      // Sort sprints by start date in descending order (newest first) as a common default
      // Sprints without a start date will be at the end.
      allSprints.sort((a, b) => {
        if (a.startDate && b.startDate) {
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        }
        if (a.startDate) return -1; // a comes first
        if (b.startDate) return 1;  // b comes first
        return 0; // no change in order if neither has a start date
      });

      console.log('Total sprints fetched and processed:', allSprints.length);
      console.log('=== JIRA API CALL END (searchSprints) ===\n');
      return allSprints;
    } catch (error: any) {
      console.error('\n=== JIRA API ERROR (searchSprints) ===');
      console.error('Error fetching sprints:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        boardId: boardId
      });
      console.error('=== JIRA API ERROR END (searchSprints) ===\n');
      throw error;
    }
  },

  async getTicketsForSprint(sprintId: string): Promise<{ tickets: JiraTicket[], total: number }> {
    try {
      console.log(`\n=== JIRA API CALL START (getTicketsForSprint for sprint ${sprintId}) ===`);
      let allIssues: any[] = [];
      let startAt = 0;
      const maxResults = 100;
      let totalCount = 0;

      while (true) {
        const response = await axios.get(`${jiraAgileBaseUrl}/sprint/${sprintId}/issue`, {
          auth: jiraAuth,
          params: {
            jql: jiraConfig.sprintIssuesJql || '', // Optional additional JQL
            fields: jiraConfig.fields.join(','),
            startAt,
            maxResults
          }
        });

        if (startAt === 0) {
          totalCount = response.data.total;
        }
        allIssues = [...allIssues, ...response.data.issues];

        if (response.data.issues.length < maxResults || (response.data.startAt + response.data.issues.length) >= response.data.total) {
          break;
        }
        startAt += maxResults;
      }
      
      console.log('\nTotal issues collected for sprint:', allIssues.length);

      const transformedTickets = allIssues
        .map((issue: any) => {
          // Transformation logic copied and adapted from getTickets()
          const blockingIssues = (issue.fields.issuelinks || [])
            .filter((link: any) => link.type.name === 'Blocks' && link.outwardIssue)
            .map((link: any) => ({
              key: link.outwardIssue.key,
              summary: link.outwardIssue.fields.summary,
              status: link.outwardIssue.fields.status.name,
              type: link.outwardIssue.fields.issuetype.name
            }));

          return {
            key: issue.key,
            summary: issue.fields.summary,
            type: issue.fields.issuetype.name,
            status: issue.fields.status.name,
            labels: issue.fields.labels || [],
            reporter: issue.fields.reporter?.displayName,
            assignee: issue.fields.assignee?.displayName, // Added assignee mapping
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
              summary: issue.fields.parent.fields.summary,
              // Attempt to get parent type if available, might need specific field inclusion
              type: issue.fields.parent.fields?.issuetype?.name
            } : undefined
          } as JiraTicket;
        })
        .filter((ticket): ticket is JiraTicket => ticket !== null);

      console.log('\nTransformed response for sprint:', {
        ticketsCount: transformedTickets.length,
        total: totalCount,
        sampleTicket: transformedTickets[0]
      });
      console.log('=== JIRA API CALL END (getTicketsForSprint) ===\n');
      return {
        tickets: transformedTickets,
        total: totalCount
      };

    } catch (error: any) {
      console.error('\n=== JIRA API ERROR (getTicketsForSprint) ===');
      console.error('Error fetching tickets for sprint:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        sprintId: sprintId
      });
      console.error('=== JIRA API ERROR END (getTicketsForSprint) ===\n');
      throw error;
    }
  }
};