# Automatic Poll Generator

A web application for managing JIRA tickets, generating PBR planning pages, and creating Teams meeting polls.

## Features

- Filter and select JIRA tickets by Project, Type, Status, and Sprint
- Generate PBR planning pages in Confluence
- Create Teams meeting polls for selected tickets
- Modern, responsive UI built with Material-UI

## Prerequisites

- Node.js 16+
- JIRA API access
- Confluence API access
- Microsoft Teams API access

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# JIRA Configuration
JIRA_HOST=diligentbrands.atlassian.net
JIRA_USERNAME=bolahlautner@diligent.com
JIRA_API_TOKEN=your-jira-api-token

# Confluence Configuration
CONFLUENCE_USERNAME=your-email@example.com
CONFLUENCE_API_TOKEN=your-confluence-api-token

# Microsoft Teams Configuration
TEAMS_TENANT_ID=your-tenant-id
TEAMS_CLIENT_ID=your-client-id
TEAMS_CLIENT_SECRET=your-client-secret
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/automatic-poll-generator.git
cd automatic-poll-generator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development servers:
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Usage

1. **JIRA Ticket Selection**
   - Navigate to the JIRA Tickets page
   - Use filters to find relevant tickets
   - Select tickets for PBR planning

2. **PBR Planning**
   - Enter the Confluence page URL
   - Review selected tickets
   - Generate the PBR planning page

3. **Teams Polls**
   - Enter the Teams meeting ID
   - Generate polls for selected tickets
   - Polls will be created with Fibonacci story point options

## Development

- Frontend: React with TypeScript, Material-UI
- Backend: Node.js with Express, TypeScript
- State Management: React Query
- API Integration: JIRA, Confluence, Microsoft Teams

## License

MIT 