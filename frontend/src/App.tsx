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
import RetroPresentation from './components/RetroPresentation'; // Added import
import { Layout } from './components/Layout';
import { Box, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <JiraProvider>
          <SelectedTicketsProvider>
            <QueueProvider>
              <EstimationProvider>
                <Router>
                  <Layout>
                    <Container maxWidth="xl">
                      <Routes>
                        <Route path="/" element={<JiraTicketSelector />} />
                        <Route path="/pbr" element={<PBRQueue />} />
                        <Route path="/poker" element={<ScrumPoker />} />
                        <Route path="/retro-presentation" element={<RetroPresentation />} /> {/* Added route */}
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