# Planning Poker & PBR Tool
A comprehensive web application for agile teams to manage JIRA tickets, conduct planning poker sessions, and generate PBR planning pages.

## Features

### Planning Poker
- Real-time planning poker sessions with WebSocket support
- Vote tracking and statistics (average, median, mode)
- Support for Fibonacci story points
- Session management with host controls
- Participant tracking and status updates

### JIRA Integration
- Advanced ticket filtering by Project, Type, Status, and Sprint
- Real-time ticket updates and synchronization
- Custom JQL query support
- Bulk ticket selection and management

### PBR (Product Backlog Refinement)
- Generate structured PBR planning pages in Confluence
- Customizable page templates
- Automatic ticket information population
- Support for multiple ticket formats

### Teams Integration
- Create Teams meeting polls for selected tickets
- Automatic poll generation with story point options
- Meeting scheduling integration
- Poll results tracking

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Material-UI for modern, responsive UI
- React Query for data fetching and caching
- WebSocket for real-time updates
- React Router for navigation

### Backend
- Node.js with Express
- TypeScript for type safety
- WebSocket service for real-time communication
- JIRA, Confluence, and Teams API integrations
- Environment-based configuration

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
JIRA_USERNAME=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_BOARD_ID=your-board-id

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
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. Start the development servers:
```bash
# From the root directory
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Usage

### Planning Poker Session
1. Navigate to the Planning Poker page
2. Create a new session or join an existing one
3. Select tickets to estimate
4. Use the voting interface to submit story point estimates
5. View real-time voting results and statistics

### JIRA Ticket Management
1. Navigate to the JIRA Tickets page
2. Use filters to find relevant tickets
3. Select tickets for PBR planning or estimation
4. View ticket details and status

### PBR Planning
1. Navigate to the PBR page
2. Enter the Confluence page URL
3. Review and organize selected tickets
4. Generate the PBR planning page
5. Verify the generated content

### Teams Integration
1. Navigate to the Teams page
2. Enter the Teams meeting ID
3. Select tickets for poll generation
4. Generate polls with story point options
5. Monitor poll results

## Development

### Project Structure
```
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── contexts/   # React contexts
│   │   ├── services/   # API services
│   │   └── types/      # TypeScript types
│   └── public/         # Static assets
├── backend/           # Node.js backend application
│   ├── src/
│   │   ├── config/    # Configuration files
│   │   ├── controllers/# Route controllers
│   │   ├── services/  # Business logic
│   │   └── types/     # TypeScript types
│   └── dist/          # Compiled JavaScript
└── package.json       # Root package configuration
```

### Available Scripts
- `npm start`: Start both frontend and backend in development mode
- `npm run build`: Build both frontend and backend
- `npm run test`: Run tests
- `npm run lint`: Run linting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details 
