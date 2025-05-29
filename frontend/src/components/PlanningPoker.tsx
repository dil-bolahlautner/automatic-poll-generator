/**
 * PlanningPoker Component
 * 
 * A real-time planning poker session component that allows teams to:
 * - Create and join planning poker sessions
 * - Vote on story points using Fibonacci sequence
 * - View real-time voting results and statistics
 * - Manage session flow (start voting, reveal votes, next ticket)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  useTheme,
  useMediaQuery,
  Fade,
  Divider,
  Avatar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CasinoIcon from '@mui/icons-material/Casino';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useQueue } from '../contexts/QueueContext';
import { planningPokerWsService } from '../services/planningPokerWebsocketService';
import { PlanningPokerSession, JiraTicket as FrontendJiraTicket, ErrorPayload, PlanningPokerUser, SessionTerminatedPayload } from '../types/planningPoker';
import { jiraService } from '../services/jiraService';
import styled from '@emotion/styled';
import { Theme } from '@mui/material/styles';
import { styled as muiStyled } from '@mui/material/styles';

// Fibonacci sequence cards for story point estimation
const FIBONACCI_CARDS = ['0', '1/2', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];

// Styled components for consistent look
const StyledPaper = muiStyled(Paper)<{ theme?: Theme }>(({ theme }) => ({
  padding: theme?.spacing(3),
  borderRadius: theme?.spacing(2),
  background: 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
}));

const VoteButton = muiStyled(Button)<{ theme?: Theme }>(({ theme }) => ({
  borderRadius: theme?.spacing(1),
  padding: theme?.spacing(2),
  minWidth: '60px',
  fontSize: '1.2rem',
  fontWeight: 'bold',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

const ActionButton = muiStyled(Button)<{ theme?: Theme }>(({ theme }) => ({
  borderRadius: theme?.spacing(1),
  padding: theme?.spacing(1.5, 3),
  textTransform: 'none',
  fontSize: '1rem',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

// Add these styled components after the existing styled components
const ParticipantsCard = muiStyled(StyledPaper)<{ 
  theme?: Theme;
  votingStatus: 'waiting' | 'voting' | 'complete';
}>(({ theme, votingStatus }) => ({
  position: 'relative',
  transition: 'all 0.3s ease',
  ...(votingStatus === 'complete' && {
    background: 'linear-gradient(145deg, #e8f5e9 0%, #f1f8e9 100%)',
  }),
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme?.spacing(2),
    border: '2px solid transparent',
    transition: 'border-color 0.3s ease',
    ...(votingStatus === 'voting' && {
      borderColor: theme?.palette.error.main,
      animation: 'pulse 2s infinite',
    }),
    ...(votingStatus === 'complete' && {
      borderColor: theme?.palette.success.main,
    }),
  },
  '@keyframes pulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.4)',
    },
    '70%': {
      boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)',
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)',
    },
  },
}));

// Add this function before the PlanningPoker component
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Add this function to generate pastel colors based on user name
const getPastelColor = (name: string): string => {
  // Use the name to generate a consistent color for each user
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 80%)`; // Pastel color with high lightness
};

/**
 * Main Planning Poker component
 * @returns {JSX.Element} The rendered component
 */
export function PlanningPoker() {
  // Context and state hooks
  const { queue: globalPbrQueue, setLiveQueue, addTicketsToGlobalQueue, removeTicketFromGlobalQueue, clearGlobalQueue } = useQueue();
  const [session, setSession] = useState<PlanningPokerSession | null>(null);
  const [userName, setUserName] = useState<string>(localStorage.getItem('planningPokerUserName') || '');
  const [sessionIdToJoin, setSessionIdToJoin] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  // const [currentView, setCurrentView] = useState<'initial' | 'lobby' | 'voting' | 'results'>('initial'); // Simplified for now

  /**
   * Handles session updates from WebSocket
   * @param updatedSession - The updated session data
   */
  const handleSessionUpdate = useCallback((updatedSession: PlanningPokerSession) => {
    console.log('Received session update:', updatedSession);
    setSession(updatedSession);
    setWsError(null);
    setIsLoading(false);
    // The logic for setting myUserId is moved to the connect .then() block
  }, [/* Removed myUserId, userName. Add back userName if it's used for other reasons here */]);

  /**
   * Handles WebSocket errors
   * @param error - The error payload
   */
  const handleError = useCallback((error: any) => { // Changed type to any for more flexible checking
    console.error('WebSocket Error:', error);
    let errorMessage = 'An unknown WebSocket error occurred.';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if (error && typeof error.details === 'string') {
      errorMessage = error.details;
    } else if (error) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        // If stringify fails, keep the default message
      }
    }
    setWsError(errorMessage);
    setIsLoading(false);
  }, []);

  const handleSessionTerminated = useCallback((payload: SessionTerminatedPayload) => {
    console.log('Session terminated:', payload);
    setSession(null);
    setWsError(`Session terminated: ${payload.reason}`);
    setIsLoading(false);
    // Potentially navigate user or show a more prominent notification
  }, []);

  // Callback for WebSocket service to update the global PBR queue
  const stableSetLiveQueue = useCallback((newQueue: FrontendJiraTicket[]) => {
    setLiveQueue(newQueue);
  }, [setLiveQueue]);

  // Persist username in localStorage
  useEffect(() => {
    localStorage.setItem('planningPokerUserName', userName);
  }, [userName]);

  // Initialize WebSocket connection and set up event handlers
  useEffect(() => {
    console.log('[PlanningPoker.tsx] Mounted. Setting up event handlers.');
    
    // Set up event handlers
    const handleSessionUpdate = (updatedSession: PlanningPokerSession) => {
      console.log('[PlanningPoker.tsx] Received session update:', updatedSession);
      setSession(updatedSession);
      setWsError(null);
      setIsLoading(false);
      
      // Update myUserId if we receive a session update
      const socketId = planningPokerWsService.getSocketId();
      if (socketId) {
        setMyUserId(socketId);
        console.log('[PlanningPoker.tsx] My User ID (Socket ID) set from session update:', socketId);
      }
    };

    const handleSessionTerminated = (payload: SessionTerminatedPayload) => {
      console.log('[PlanningPoker.tsx] Session terminated:', payload);
      setSession(null);
      setWsError(`Session terminated: ${payload.reason}`);
      setIsLoading(false);
    };

    const handleError = (error: any) => {
      console.error('[PlanningPoker.tsx] WebSocket Error:', error);
      let errorMessage = 'An unknown WebSocket error occurred.';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error && typeof error.details === 'string') {
        errorMessage = error.details;
      } else if (error) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          // If stringify fails, keep the default message
        }
      }
      setWsError(errorMessage);
      setIsLoading(false);
    };

    // Register event handlers with the WebSocket service
    planningPokerWsService.onSessionUpdate(handleSessionUpdate);
    planningPokerWsService.onSessionTerminated(handleSessionTerminated);
    planningPokerWsService.onError(handleError);

    // Connect to WebSocket if not already connected
    if (!planningPokerWsService.isConnected()) {
      console.log('[PlanningPoker.tsx] Not connected, attempting to connect...');
      setIsLoading(true);
      planningPokerWsService.connect(
        handleSessionUpdate,
        handleSessionTerminated,
        stableSetLiveQueue,
        handleError
      ).then(() => {
        console.log('[PlanningPoker.tsx] Connection successful');
        setIsLoading(false);
      }).catch((error) => {
        console.error('[PlanningPoker.tsx] Connection failed:', error);
        setWsError('Failed to connect to session server: ' + (error.message || 'Unknown error'));
        setIsLoading(false);
      });
    } else {
      console.log('[PlanningPoker.tsx] Already connected');
      setIsLoading(false);
    }

    return () => {
      console.log('[PlanningPoker.tsx] Unmounting. Cleaning up event handlers.');
      // Unregister event handlers
      planningPokerWsService.offSessionUpdate(handleSessionUpdate);
      planningPokerWsService.offSessionTerminated(handleSessionTerminated);
      planningPokerWsService.offError(handleError);
      setSession(null); // Clear local session state
    };
  }, [stableSetLiveQueue]); // Only depend on stableSetLiveQueue

  /**
   * Creates a new planning poker session
   */
  const handleCreateSession = () => {
    if (!userName.trim()) {
      setWsError('Please enter your name.');
      return;
    }
    // globalPbrQueue is now managed by WebSocket and QueueContext
    if (globalPbrQueue.length === 0) {
      setWsError('The global PBR queue is empty. Add tickets before creating a session.');
      return;
    }
    setWsError(null);
    setIsLoading(true);
    // No need to pass tickets; backend uses its globalPbrQueue
    planningPokerWsService.createSession(userName.trim());
  };

  // Note: The component responsible for adding tickets to the PBR queue (e.g., JiraTicketSelector)
  // should now use `addTicketsToGlobalQueue` from `useQueue()`.
  // That component will be responsible for ensuring the tickets it passes to
  // `addTicketsToGlobalQueue` are of type `FrontendJiraTicket` (from `../types/planningPoker`)
  // and include the `url` (e.g., by calling `jiraService.getTicketUrl(t.key)`).

  /**
   * Joins an existing planning poker session
   */
  const handleJoinSession = () => {
    if (!userName.trim()) {
      setWsError('Please enter your name.');
      return;
    }
    if (!sessionIdToJoin.trim()) {
      setWsError('Please enter a Session ID to join.');
      return;
    }
    setWsError(null);
    setIsLoading(true);
    console.log('[PlanningPoker.tsx] Joining session:', sessionIdToJoin);
    planningPokerWsService.joinSession(sessionIdToJoin.trim(), userName.trim());
  };

  /**
   * Removes a ticket from the queue
   * @param ticketKey - The key of the ticket to remove
   */
  const handleRemoveTicketFromQueue = (ticketKey: string) => {
    // This will emit an event to the server, which then broadcasts the updated queue
    removeTicketFromGlobalQueue(ticketKey);
  };

  // Example of how clearing the queue would be handled if there was a UI button for it:
  // const handleClearGlobalPbrQueue = () => {
  //  clearGlobalQueue();
  // };

  /**
   * Starts voting on the current ticket
   */
  const handleStartVoting = () => {
    setIsLoading(true);
    if (session?.id && session.currentTicketKey) {
      planningPokerWsService.startVoting(session.id, session.currentTicketKey);
    } else if (session?.id && session.tickets.length > 0 && !session.currentTicketKey) {
      planningPokerWsService.startVoting(session.id, session.tickets[0].key);
    } else {
      setIsLoading(false); // No action taken
    }
  };

  /**
   * Submits a vote for the current ticket
   * @param voteValue - The story point value to vote for
   */
  const handleVote = (voteValue: string) => {
    if (session?.id && me && !me.hasVoted && session.votingOpen) {
      setIsLoading(true); // Indicate activity while vote is sent
      planningPokerWsService.submitVote(session.id, voteValue);
      // Note: The loading state will be cleared when we receive the session update
    }
  };

  /**
   * Reveals all votes for the current ticket
   */
  const handleRevealVotes = () => {
    if (session?.id && me?.isHost) {
      setIsLoading(true);
      planningPokerWsService.revealVotes(session.id);
    }
  };

  /**
   * Moves to the next ticket in the session
   */
  const handleNextTicket = () => {
    if (session?.id && me?.isHost) {
      setIsLoading(true);
      planningPokerWsService.nextTicket(session.id);
    }
  };

  /**
   * Clears the current session and returns to initial view
   */
  const handleClearSession = () => {
    if (session?.id && me?.isHost) {
      setIsLoading(true);
      planningPokerWsService.clearSession(session.id);
    }
  };

  const handleLeaveSession = () => {
    if (session?.id) {
      setIsLoading(true);
      planningPokerWsService.leaveSession(session.id);
    }
  };

  // --- Render logic starts here ---

  if (isLoading && !session) { // Initial loading state
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Connecting to session server...</Typography>
      </Box>
    );
  }

  // Initial View: Enter Name, Create/Join Session
  if (!session) {
    return (
      <Box sx={{ maxWidth: 600, margin: 'auto', p: { xs: 2, sm: 3 } }}>
        <Fade in={true}>
          <StyledPaper elevation={3}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <CasinoIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                Planning Poker
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Create or join a real-time Planning Poker session with your team
              </Typography>
            </Box>

            {wsError && (
              <Fade in={!!wsError}>
                <Alert severity="error" sx={{ mb: 3 }}>{wsError}</Alert>
              </Fade>
            )}

            <TextField
              label="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              fullWidth
              margin="normal"
              disabled={isLoading}
              variant="outlined"
              sx={{ mb: 2 }}
            />

            <Stack spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCreateSession}
                fullWidth
                disabled={isLoading || globalPbrQueue.length === 0}
                startIcon={<PlayArrowIcon />}
                size="large"
              >
                Create New Session
              </Button>
              <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
                (Requires tickets in the PBR Queue below)
              </Typography>

              <Divider sx={{ my: 2 }}>or</Divider>

              <TextField
                label="Session ID to Join"
                value={sessionIdToJoin}
                onChange={(e) => setSessionIdToJoin(e.target.value)}
                fullWidth
                margin="normal"
                disabled={isLoading}
                variant="outlined"
              />
              <Button
                variant="outlined"
                color="primary"
                onClick={handleJoinSession}
                fullWidth
                disabled={isLoading}
                size="large"
              >
                Join Existing Session
              </Button>
            </Stack>
          </StyledPaper>
        </Fade>

        {/* Ticket Queue Display */}
        <StyledPaper sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon color="primary" />
            Global PBR Queue ({globalPbrQueue.length})
          </Typography>
          <List>
            {globalPbrQueue.map((ticket) => (
              <ListItem
                key={ticket.key}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.default',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveTicketFromQueue(ticket.key)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <Typography variant="subtitle1" component="div">
                    {ticket.key}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={ticket.type} />
                      <Chip size="small" label={ticket.status} color={ticket.status === 'Done' ? 'success' : 'default'} />
                    </Stack>
                  </Box>
                </Box>
              </ListItem>
            ))}
            {globalPbrQueue.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                The Global PBR Queue is empty. Add tickets using the Jira Ticket Selector.
              </Typography>
            )}
          </List>
        </StyledPaper>
      </Box>
    );
  }

  // --- Session Active View (Lobby, Voting, Results) ---
  // This part will be built out in subsequent steps.
  // For now, just display basic session info.
  const me = session.users.find(u => u.id === myUserId);
  const currentTicket = session.currentTicketKey && session.tickets
    ? session.tickets.find(t => t.key === session.currentTicketKey)
    : null;

  const getVoteCounts = () => {
    if (!session || !session.votesRevealed) return {};
    const counts: Record<string, number> = {};
    session.users.forEach(user => {
      if (user.vote) {
        counts[user.vote] = (counts[user.vote] || 0) + 1;
      }
    });
    return counts;
  };
  const voteCounts = getVoteCounts();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Fade in={true}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ flex: 1, minWidth: 200 }}>
              Planning Poker Session
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`Session ID: ${session.id}`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
              {me?.isHost && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearSession}
                  disabled={isLoading}
                  startIcon={<DeleteIcon />}
                >
                  Clear Session
                </Button>
              )}
              {!me?.isHost && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleLeaveSession}
                  disabled={isLoading}
                  startIcon={<DeleteIcon />}
                >
                  Leave Session
                </Button>
              )}
            </Stack>
          </Box>

          {wsError && (
            <Fade in={!!wsError}>
              <Alert severity="error" sx={{ mb: 3 }}>{wsError}</Alert>
            </Fade>
          )}

          <Grid container spacing={3}>
            {/* Participants List */}
            <Grid item xs={12} md={4}>
              <ParticipantsCard
                votingStatus={
                  session.votingOpen
                    ? (session.users.every(user => user.hasVoted)
                        ? 'complete'
                        : 'voting')
                    : 'waiting'
                }
              >
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <GroupIcon color="primary" />
                  Participants ({session.users.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                  {session.users.map(user => (
                    <Box
                      key={user.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: getPastelColor(user.name),
                          width: 48,
                          height: 48,
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: 'text.primary',
                          border: user.isHost ? '2px solid' : 'none',
                          borderColor: 'primary.main',
                          mb: 0.5,
                          transition: 'all 0.3s ease',
                          ...(session.votingOpen && user.hasVoted && {
                            boxShadow: '0 0 0 2px #4caf50',
                          }),
                        }}
                      >
                        {getInitials(user.name)}
                      </Avatar>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          textAlign: 'center',
                          maxWidth: 80,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: user.id === myUserId ? 600 : 400,
                        }}
                      >
                        {user.name}
                        {user.isHost && ' (H)'}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          textAlign: 'center',
                          maxWidth: 80,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {session.votesRevealed
                          ? `Voted: ${user.vote || 'N/A'}`
                          : (session.votingOpen
                            ? (user.hasVoted ? 'Voted' : 'Waiting...')
                            : '')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </ParticipantsCard>
            </Grid>

            {/* Current Ticket & Voting Area */}
            <Grid item xs={12} md={8}>
              {currentTicket ? (
                <StyledPaper>
                  <CardContent>
                    <Typography variant="h5" gutterBottom>
                      {currentTicket.key}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" paragraph>
                      {currentTicket.summary}
                    </Typography>
                    {currentTicket.description && (
                      <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                        {currentTicket.description}
                      </Typography>
                    )}
                    <Button
                      component="a"
                      href={currentTicket.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      size="small"
                      sx={{ mt: 2 }}
                    >
                      View in Jira
                    </Button>

                    {/* Voting UI */}
                    <Box sx={{ mt: 4 }}>
                      <Typography variant="h6" gutterBottom>
                        {session.votingOpen 
                          ? (me?.hasVoted 
                            ? 'Your Vote Has Been Submitted'
                            : 'Cast Your Vote')
                          : (session.votesRevealed 
                            ? 'Voting Results'
                            : 'Waiting for host to start voting...')}
                      </Typography>
                      <Grid container spacing={1} justifyContent="center">
                        {FIBONACCI_CARDS.map((cardValue) => (
                          <Grid item key={cardValue}>
                            <VoteButton
                              variant={me?.vote === cardValue ? "contained" : "outlined"}
                              color={me?.vote === cardValue ? "primary" : "inherit"}
                              onClick={() => handleVote(cardValue)}
                              disabled={
                                !session.votingOpen || 
                                !!me?.hasVoted || 
                                session.votesRevealed ||
                                isLoading
                              }
                              sx={{
                                opacity: me?.hasVoted && me?.vote !== cardValue ? 0.5 : 1,
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                  transform: !me?.hasVoted && session.votingOpen ? 'translateY(-2px)' : 'none',
                                  boxShadow: !me?.hasVoted && session.votingOpen ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
                                }
                              }}
                            >
                              {cardValue}
                            </VoteButton>
                          </Grid>
                        ))}
                      </Grid>
                      {me?.hasVoted && !session.votesRevealed && (
                        <Typography sx={{ mt: 2, textAlign: 'center' }} color="text.secondary">
                          Your vote: {me.vote} (Waiting for others...)
                        </Typography>
                      )}
                    </Box>

                    {/* Results Display */}
                    {session.votesRevealed && currentTicket && (
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="h6" gutterBottom>
                          Voting Results
                        </Typography>
                        <Grid container spacing={2}>
                          {Object.entries(voteCounts).map(([voteValue, count]) => {
                            // Get list of voters for this value
                            const voters = session.users
                              .filter(user => user.vote === voteValue)
                              .map(user => user.name);
                            
                            return (
                              <Grid item xs={12} sm={6} md={4} key={voteValue}>
                                <Paper
                                  elevation={0}
                                  sx={{
                                    p: 2,
                                    textAlign: 'center',
                                    bgcolor: 'background.default',
                                    borderRadius: 2,
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                  }}
                                >
                                  <Typography variant="h4" color="primary" sx={{ mb: 1 }}>
                                    {voteValue}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {count} vote{count !== 1 ? 's' : ''}
                                  </Typography>
                                  <Box sx={{ mt: 'auto', pt: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                      {voters.join(', ')}
                                    </Typography>
                                  </Box>
                                </Paper>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', p: 2, flexWrap: 'wrap', gap: 1 }}>
                    {/* User status / action prompts */}
                    <Box>
                      {!me?.isHost && session.votingOpen && !me?.hasVoted && !session.votesRevealed && (
                        <Typography color="text.secondary">Please cast your vote.</Typography>
                      )}
                      {!me?.isHost && session.votingOpen && me?.hasVoted && !session.votesRevealed && (
                        <Typography color="text.secondary">Vote submitted. Waiting for host to reveal.</Typography>
                      )}
                      {!me?.isHost && !session.votingOpen && session.votesRevealed && currentTicket && (
                        <Typography color="text.secondary">Voting closed. Waiting for next ticket.</Typography>
                      )}
                      {!me?.isHost && !session.votingOpen && !session.votesRevealed && currentTicket && (
                        <Typography color="text.secondary">Waiting for host to start voting...</Typography>
                      )}
                    </Box>

                    {/* Host Actions */}
                    {me?.isHost && (
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {!session.votingOpen && !session.votesRevealed && currentTicket && (
                          <ActionButton
                            variant="contained"
                            onClick={handleStartVoting}
                            disabled={isLoading}
                            startIcon={<PlayArrowIcon />}
                          >
                            Start Voting
                          </ActionButton>
                        )}
                        {session.votingOpen && !session.votesRevealed && (
                          <ActionButton
                            variant="contained"
                            color="secondary"
                            onClick={handleRevealVotes}
                            disabled={isLoading}
                            startIcon={<VisibilityIcon />}
                          >
                            Reveal Votes
                          </ActionButton>
                        )}
                        {session.votesRevealed && currentTicket && (
                          <ActionButton
                            variant="contained"
                            onClick={handleNextTicket}
                            disabled={isLoading}
                            startIcon={<NavigateNextIcon />}
                          >
                            {session.tickets.findIndex(t => t.key === currentTicket.key) < session.tickets.length - 1
                              ? 'Next Ticket'
                              : 'End Session'}
                          </ActionButton>
                        )}
                      </Stack>
                    )}
                  </CardActions>
                </StyledPaper>
              ) : (
                <StyledPaper sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="h5" gutterBottom>
                    {session.tickets.length > 0 && session.currentTicketKey === null && session.votesRevealed
                      ? 'All tickets have been estimated!'
                      : (session.tickets.length > 0
                        ? 'Waiting for host to select a ticket or start voting...'
                        : 'No tickets loaded in this session.')}
                  </Typography>
                  {me?.isHost && session.tickets.length > 0 && session.currentTicketKey === null && session.votesRevealed && (
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                      You can review the PBR queue or start a new session.
                    </Typography>
                  )}
                  {me?.isHost && session.tickets.length === 0 && (
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                      Please add tickets to the PBR queue and create a new session to begin.
                    </Typography>
                  )}
                </StyledPaper>
              )}
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
}