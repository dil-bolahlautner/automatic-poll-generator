/**
 * Main App component for the Planning Poker application
 * Sets up the application's routing, theming, and context providers
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

// Services
import planningPokerWsService from './services/planningPokerWebsocketService';

// Contexts
import { useQueue } from './contexts/QueueContext';
import { JiraProvider } from './contexts/JiraContext';
import { SelectedTicketsProvider } from './contexts/SelectedTicketsContext';
import { QueueProvider } from './contexts/QueueContext';
import { EstimationProvider } from './contexts/EstimationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import { JiraTicketSelector } from './components/JiraTicketSelector';
import { PBRQueue } from './components/PBRQueue';
import RetroPresentation from './components/RetroPresentation';
import { Layout } from './components/Layout';
import { PlanningPoker } from './components/PlanningPoker';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import AdminUsers from './pages/AdminUsers';

// Types
import { ErrorPayload, SessionTerminatedPayload, PlanningPokerSession, JiraTicket } from './types/planningPoker';

// Initialize React Query client for data fetching and caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

/**
 * WebSocket event handlers for the application
 */
const useWebSocketHandlers = () => {
  const { setLiveQueue } = useQueue();
  const { token } = useAuth();

  useEffect(() => {
    const handleQueueUpdate = (updatedQueue: JiraTicket[]) => {
      console.log('[AppCore] Queue update received:', updatedQueue);
      setLiveQueue(updatedQueue);
    };

    const handleError = (error: ErrorPayload) => {
      console.error('[AppCore] WebSocket error:', error);
    };

    const handleSessionUpdate = (session: PlanningPokerSession) => {
      console.log('[AppCore] Session update received:', session);
    };

    const handleSessionTerminated = (payload: SessionTerminatedPayload) => {
      console.log('[AppCore] Session terminated:', payload);
    };

    const handleConnect = () => {
      console.log('[AppCore] WebSocket connected.');
    };

    const handleDisconnect = (reason: string) => {
      console.log('[AppCore] WebSocket disconnected:', reason);
    };

    // Register event listeners
    planningPokerWsService.onQueueUpdate(handleQueueUpdate);
    planningPokerWsService.onError(handleError);
    planningPokerWsService.onSessionUpdate(handleSessionUpdate);
    planningPokerWsService.onSessionTerminated(handleSessionTerminated);
    planningPokerWsService.onConnected(handleConnect);
    planningPokerWsService.onDisconnected(handleDisconnect);

    // Attempt to connect with authentication token
    planningPokerWsService.connect(token || undefined);

    // Cleanup on component unmount
    return () => {
      planningPokerWsService.offQueueUpdate(handleQueueUpdate);
      planningPokerWsService.offError(handleError);
      planningPokerWsService.offSessionUpdate(handleSessionUpdate);
      planningPokerWsService.offSessionTerminated(handleSessionTerminated);
      planningPokerWsService.offConnected(handleConnect);
      planningPokerWsService.offDisconnected(handleDisconnect);
      planningPokerWsService.disconnect();
    };
  }, [setLiveQueue, token]);
};

/**
 * Main application core component with WebSocket integration
 */
function AppCore() {
  useWebSocketHandlers();

  return (
    <Routes>
      <Route path="/" element={<Layout><Outlet /></Layout>}>
        <Route index element={<JiraTicketSelector />} />
        <Route path="pbr" element={<PBRQueue />} />
        <Route path="poker" element={<PlanningPoker />} />
        <Route path="retro-presentation" element={<RetroPresentation />} />
        <Route path="admin/users" element={<AdminUsers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Higher-order component that requires authentication
 */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  const location = useLocation();
  
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
}

/**
 * Higher-order component that requires admin privileges
 */
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user?.is_admin) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  return children;
}

/**
 * Main App component that wraps the application with necessary providers and routing
 */
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected admin routes */}
              <Route path="/admin/users" element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminUsers />
                  </RequireAdmin>
                </RequireAuth>
              } />
              
              {/* Protected application routes */}
              <Route path="*" element={
                <RequireAuth>
                  <JiraProvider>
                    <SelectedTicketsProvider>
                      <QueueProvider>
                        <EstimationProvider>
                          <AppCore />
                        </EstimationProvider>
                      </QueueProvider>
                    </SelectedTicketsProvider>
                  </JiraProvider>
                </RequireAuth>
              } />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;