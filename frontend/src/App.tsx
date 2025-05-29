/**
 * Main App component for the Planning Poker application
 * Sets up the application's routing, theming, and context providers
 */

import React, { useEffect, useCallback } from 'react'; // Added useEffect, useCallback
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { planningPokerWsService } from './services/planningPokerWebsocketService'; // Import WebSocket service
import { useQueue } from './contexts/QueueContext'; // To get setLiveQueue
import { ErrorPayload, SessionTerminatedPayload, PlanningPokerSession, JiraTicket } from './types/planningPoker'; // Import types
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

// This component will now contain the logic that needs access to QueueContext
function AppCore() {
  const { setLiveQueue } = useQueue();
  // This log will now correctly show the function from QueueProvider
  console.log('[AppCore] setLiveQueue from useQueue():', typeof setLiveQueue === 'function' ? 'function' : setLiveQueue);

  const stableOnGlobalPbrQueueUpdate = useCallback((queue: JiraTicket[]) => {
    console.log('[AppCore] stableOnGlobalPbrQueueUpdate called. New queue length:', queue.length, 'Queue:', queue);
    setLiveQueue(queue);
  }, [setLiveQueue]);

  const stableOnError = useCallback((error: ErrorPayload) => {
    console.error('[AppCore] Global WebSocket Error:', error);
  }, []);

  const stableOnSessionUpdate = useCallback((session: PlanningPokerSession) => {
    console.log('[AppCore] Global Session Update (stub):', session);
  }, []);

  const stableOnSessionTerminated = useCallback((payload: SessionTerminatedPayload) => {
    console.log('[AppCore] Global Session Terminated (stub):', payload);
  }, []);

  useEffect(() => {
    console.log('[AppCore] Attempting to connect WebSocket...');
    planningPokerWsService.connect(
      stableOnSessionUpdate,
      stableOnSessionTerminated,
      stableOnGlobalPbrQueueUpdate,
      stableOnError
    )
    .then(() => {
      console.log('[AppCore] WebSocket connected via AppCore.');
    })
    .catch(err => {
      console.error('[AppCore] Failed to connect WebSocket via AppCore:', err);
    });

    return () => {
      console.log('[AppCore] Disconnecting WebSocket due to AppCore unmount.');
      planningPokerWsService.disconnect();
    };
  }, [stableOnGlobalPbrQueueUpdate, stableOnError, stableOnSessionUpdate, stableOnSessionTerminated]);

  return (
    <Router>
      <Layout>
        <Container maxWidth="xl">
          <Routes>
            <Route path="/" element={<JiraTicketSelector />} />
            <Route path="/pbr" element={<PBRQueue />} />
            <Route path="/poker" element={<ScrumPoker />} />
            <Route path="/retro-presentation" element={<RetroPresentation />} />
          </Routes>
        </Container>
      </Layout>
    </Router>
  );
}

// App component now focuses on providing contexts
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <JiraProvider>
          <SelectedTicketsProvider>
            <QueueProvider> {/* QueueProvider is an ancestor of AppCore */}
              <EstimationProvider>
                <AppCore /> {/* AppCore is now a child of QueueProvider */}
              </EstimationProvider>
            </QueueProvider>
          </SelectedTicketsProvider>
        </JiraProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;