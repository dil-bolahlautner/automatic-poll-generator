export const confluenceConfig = {
  host: process.env.CONFLUENCE_HOST || 'https://diligentbrands.atlassian.net',
  username: process.env.CONFLUENCE_USERNAME,
  apiToken: process.env.CONFLUENCE_API_TOKEN,
  // JIRA base URL for ticket links in Confluence content
  jiraBrowseUrl: `${process.env.JIRA_HOST || 'https://diligentbrands.atlassian.net'}/browse/`,
  // Confluence space key for generating page URLs
  spaceKey: process.env.CONFLUENCE_SPACE_KEY || 'QST'
};