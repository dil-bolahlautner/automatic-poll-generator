/**
 * Main App component for the Planning Poker application
 * Sets up the application's routing, theming, and context providers
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JiraProvider } from './contexts/JiraContext';
import { SelectedTicketsProvider } from './contexts/SelectedTicketsContext';
import { QueueProvider } from './contexts/QueueContext';
import { EstimationProvider } from './contexts/EstimationContext';
import { JiraTicketSelector } from './components/JiraTicketSelector';
import { ScrumPoker } from './components/ScrumPoker';
import { PBRQueue } from './components/PBRQueue';
import RetroPresentation from './components/RetroPresentation';
import { Layout } from './components/Layout';
import { Box, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

// Initialize React Query client for data fetching and caching
const queryClient = new QueryClient();

// Define the application's theme using Material-UI
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2', // Primary blue color
    },
    secondary: {
      main: '#dc004e', // Secondary red color
    },
  },
});

/**
 * Main App component that wraps the application with necessary providers and routing
 * @returns {JSX.Element} The rendered application
 */
function App() {
  return (
    // React Query provider for data fetching
    <QueryClientProvider client={queryClient}>
      {/* Material-UI theme provider */}
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* Reset CSS to ensure consistent styling */}
        
        {/* Jira integration context provider */}
        <JiraProvider>
          {/* Context for managing selected tickets */}
          <SelectedTicketsProvider>
            {/* Context for managing the PBR queue */}
            <QueueProvider>
              {/* Context for managing estimation state */}
              <EstimationProvider>
                {/* Router setup for navigation */}
                <Router>
                  {/* Main layout wrapper */}
                  <Layout>
                    <Container maxWidth="xl">
                      {/* Application routes */}
                      <Routes>
                        {/* Home page - Jira ticket selection */}
                        <Route path="/" element={<JiraTicketSelector />} />
                        {/* PBR queue management */}
                        <Route path="/pbr" element={<PBRQueue />} />
                        {/* Planning poker session */}
                        <Route path="/poker" element={<ScrumPoker />} />
                        {/* Retrospective presentation */}
                        <Route path="/retro-presentation" element={<RetroPresentation />} />
                      </Routes>
                    </Container>
                  </Layout>
                </Router>
              </EstimationProvider>
            </QueueProvider>
          </SelectedTicketsProvider>
        </JiraProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App; 