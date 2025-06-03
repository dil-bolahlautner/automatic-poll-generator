import axios, { AxiosBasicCredentials } from 'axios';
import { JiraTicket } from './jiraService'; // Assuming JiraTicket includes assignee and status
import { confluenceConfig } from '../config/confluence';

interface ConfluencePage {
  id: string;
  title: string;
  version: {
    number: number;
  };
  body: {
    storage: {
      value: string;
    };
  };
}

// Interfaces matching frontend structure for topics data
export interface FrontendEpicWithTickets {
  epicKey: string;
  epicSummary: string;
  tickets: JiraTicket[];
}

export interface FrontendTopic {
  id: string;
  title: string;
  owner: string; // Presenter's name
  epics: FrontendEpicWithTickets[];
}


export class ConfluenceService {
  private baseUrl: string;
  private auth: AxiosBasicCredentials;

  constructor() {
    this.baseUrl = `${confluenceConfig.host}/wiki`;
    
    const username = confluenceConfig.username;
    const apiToken = confluenceConfig.apiToken;

    console.log('Confluence Configuration Initialized:');
    console.log('Host:', confluenceConfig.host);
    console.log('Username:', username ? username.substring(0,3) + '***' : 'MISSING');
    console.log('API Token:', apiToken ? '***' : 'MISSING');

    if (!username || !apiToken) {
      throw new Error('Confluence credentials (username or API token) not configured. Please check your .env file and ensure CONFLUENCE_USERNAME and CONFLUENCE_API_TOKEN are set.');
    }

    this.auth = {
      username,
      password: apiToken
    };
  }

  /**
   * @deprecated Use generateRetroDemoPage instead for the new retro demo format.
   */
  async generateTable(pageUrl: string, tickets: JiraTicket[]): Promise<void> {
    try {
      const pageId = this.extractPageId(pageUrl);
      console.log('pageId (deprecated generateTable):', pageId);
      if (!pageId) {
        throw new Error('Invalid Confluence page URL. Could not extract page ID.');
      }
      const page = await this.getPage(pageId);
      const tableHtml = this.generateLegacyTableHtml(tickets); 
      await this.updatePageContent(pageId, page.title, page.version.number, tableHtml);
    } catch (error: any) {
      console.error('Error in generateTable (deprecated):', error);
      if (error.response) {
        throw new Error(`Confluence API error: ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  private extractPageId(pageUrl: string): string | undefined {
    console.log('Extracting pageId from URL:', pageUrl);
    try {
      const url = new URL(pageUrl);
      if (url.pathname.includes('/pages/viewpage.action')) {
        return url.searchParams.get('pageId') || undefined;
      }
      const match = url.pathname.match(/\/pages\/(\d+)/);
      return match ? match[1] : undefined;
    } catch(e) {
      console.error("Error parsing page URL for ID extraction:", e);
      return undefined;
    }
  }

  private async getPage(pageId: string): Promise<ConfluencePage> {
    try {
      console.log('Fetching Confluence page:', `${this.baseUrl}/rest/api/content/${pageId}`);
      const response = await axios.get(`${this.baseUrl}/rest/api/content/${pageId}`, {
        auth: this.auth,
        params: {
          expand: 'body.storage,version'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting page:', error.response?.data || error.message);
      throw new Error(`Failed to get Confluence page: ${error.response?.data?.message || error.message}`);
    }
  }

  private generateLegacyTableHtml(tickets: JiraTicket[]): string {
    const E = this.escapeHtml; 
    return `
      <table data-testid="renderer-table" data-number-column="false" data-table-width="760" data-layout="default">
        <tbody>
          <tr>
            <th>Ticket to Fix</th><th>Task type</th><th>Description / Information</th><th>Depending on</th><th>Target version</th><th>Reporter</th>
          </tr>
          ${tickets.map(ticket => {
            const blockingIssues = ticket.blockingIssues || [];
            const blockingIssueLinks = blockingIssues.map(issue => 
              `<a href="${confluenceConfig.jiraBrowseUrl}${E(issue.key)}">${E(issue.key)}</a>`
            ).join(', ');

            const targetVersion = ticket.fixVersions?.[0]?.name || '';
            const formattedVersion = targetVersion.startsWith('QST 4.') ? '4.0' :
                                   targetVersion.startsWith('QST 3.') ? '3.x' :
                                   targetVersion;
            const isGreen = formattedVersion === '4.0';

            return `
              <tr>
                <td><a href="${confluenceConfig.jiraBrowseUrl}${E(ticket.key)}">${E(ticket.key)}</a></td>
                <td>${E(ticket.type)}</td>
                <td>${E(ticket.summary)}</td>
                <td>${blockingIssueLinks}</td>
                <td><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">${isGreen ? 'Green' : 'Blue'}</ac:parameter><ac:parameter ac:name="title">${E(formattedVersion)}</ac:parameter></ac:structured-macro></td>
                <td>${E(ticket.reporter) || ''}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  private async updatePageContent(pageId: string, pageTitle: string, currentVersionNumber: number, newBodyContent: string): Promise<void> {
    try {
      console.log(`Updating Confluence page ID ${pageId}, title "${pageTitle}", new version ${currentVersionNumber + 1}`);
      await axios.put(`${this.baseUrl}/rest/api/content/${pageId}`, {
        id: pageId,
        version: {
          number: currentVersionNumber + 1
        },
        title: pageTitle, 
        type: 'page',
        body: {
          storage: {
            value: newBodyContent, 
            representation: 'storage'
          }
        }
      }, {
        auth: this.auth,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`Successfully updated Confluence page ID ${pageId}`);
    } catch (error: any) {
      console.error('Error updating Confluence page content:', error.response?.data || error.message);
      throw new Error(`Failed to update Confluence page: ${error.response?.data?.message || error.message}`);
    }
  }

  private escapeHtml(unsafe: string | undefined | null): string {
    if (unsafe === undefined || unsafe === null) return '';
    const entityMap: { [key: string]: string } = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#039;'
    };
    return unsafe.replace(/[&<>"']/g, (s) => entityMap[s]);
  }

  private generateRetroDemoHtml(topicsData: FrontendTopic[], sprintName: string): string {
    const E = this.escapeHtml; 

    let html = `<h1>Retro Demo Material: ${E(sprintName)}</h1>`;

    html += `<h2>Introduction</h2>`;
    html += `<p>This page summarizes the demo material for the retro session of sprint: <strong>${E(sprintName)}</strong>.</p>`;
    html += `<p>The following topics will be covered, showcasing completed work and key learnings.</p>`;

    html += `<h2>Topics</h2>`;
    if (topicsData.length === 0) {
      html += `<p>No topics defined for this retro.</p>`;
    } else {
      topicsData.forEach(topic => {
        html += `<h3>${E(topic.title)}</h3>`;
        html += `<p><strong>Owner/Presenter:</strong> ${E(topic.owner)}</p>`;

        if (topic.epics.length === 0) {
          html += `<p><em>No epics or tickets assigned to this topic.</em></p>`;
        } else {
          html += `<table data-layout="default" ac:local-id="retro-topic-${E(topic.id)}-table"><thead><tr><th>Epic / Group</th><th>Ticket ID</th><th>Summary</th><th>Assignee</th><th>Demo Instructions/Notes</th></tr></thead><tbody>`;
          topic.epics.forEach(epic => {
            const epicDisplay = epic.epicKey === 'NO_EPIC' ? E(epic.epicSummary) : `${E(epic.epicSummary)} (${E(epic.epicKey)})`;
            const doneTickets = epic.tickets.filter(t => t.status && t.status.toLowerCase() === 'done');

            if (doneTickets.length === 0) {
               html += `<tr><td>${epicDisplay}</td><td colspan="4"><em>No 'Done' tickets in this group for the demo.</em></td></tr>`;
            } else {
              doneTickets.forEach((ticket, index) => {
                html += `<tr>`;
                if (index === 0) {
                  html += `<td rowspan="${doneTickets.length}">${epicDisplay}</td>`;
                }
                html += `<td><a href="${confluenceConfig.jiraBrowseUrl}${E(ticket.key)}">${E(ticket.key)}</a></td>`;
                html += `<td>${E(ticket.summary)}</td>`;
                html += `<td>${E(ticket.assignee || 'Unassigned')}</td>`;
                html += `<td><!-- TODO: Add field for demo instructions per ticket if needed --></td>`;
                html += `</tr>`;
              });
            }
          });
          html += `</tbody></table>`;
        }
      });
    }

    html += `<h2>Instructions for Demo</h2>`;
    html += `<ul>`;
    html += `<li>Keep descriptions brief but informative.</li>`;
    html += `<li>Include actionable demo instructions (e.g., links to specific environments, test credentials, video snippets if applicable). Use the "Demo Instructions/Notes" column above.</li>`;
    html += `<li>Ensure Jira ticket IDs are mentioned for traceability.</li>`;
    html += `<li>Follow up with the topic owner for any questions.</li>`;
    html += `</ul>`;
    
    html += `<p><br/><em>Page generated by Kilo Code. For follow-up regarding page generation, contact Kilo Code.</em></p>`;

    return html;
  }

  async generateRetroDemoPage(pageUrl: string, topicsData: FrontendTopic[], sprintName: string): Promise<{pageId: string, pageTitle: string, confluenceViewUrl: string}> {
    try {
      const pageId = this.extractPageId(pageUrl);
      if (!pageId) {
        throw new Error('Invalid Confluence page URL. Could not extract page ID. Please ensure the URL points to an existing Confluence page.');
      }

      console.log(`Fetching existing Confluence page ID: ${pageId} for retro demo generation.`);
      const page = await this.getPage(pageId); 
      console.log(`Existing page title: "${page.title}", version: ${page.version.number}`);

      console.log(`Generating HTML content for sprint: ${sprintName}`);
      const newHtmlBody = this.generateRetroDemoHtml(topicsData, sprintName);

      await this.updatePageContent(pageId, page.title, page.version.number, newHtmlBody);
      
      const confluenceViewUrl = `${confluenceConfig.host}/wiki/pages/viewpage.action?pageId=${pageId}`;
      return { pageId, pageTitle: page.title, confluenceViewUrl };

    } catch (error: any) {
      console.error('Error in generateRetroDemoPage:', error.message);
      if (error.response) {
        console.error('Confluence API Error Response:', error.response.data);
        throw new Error(`Confluence API error: ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }
}

let serviceInstance: ConfluenceService | null = null;

export function getConfluenceService(): ConfluenceService {
  if (!serviceInstance) {
    serviceInstance = new ConfluenceService();
  }
  return serviceInstance;
}