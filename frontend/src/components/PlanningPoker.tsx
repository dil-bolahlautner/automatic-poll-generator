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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQueue } from '../contexts/QueueContext';
import { planningPokerWsService } from '../services/planningPokerWebsocketService';
import { PlanningPokerSession, JiraTicket as FrontendJiraTicket, ErrorPayload, PlanningPokerUser } from '../types/planningPoker';
// import { Link as RouterLink } from 'react-router-dom'; // Not needed for external link
import { jiraService } from '../services/jiraService'; // Import jiraService

// Fibonacci sequence cards for story point estimation
const FIBONACCI_CARDS = ['0', '1/2', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];

/**
 * Main Planning Poker component
 * @returns {JSX.Element} The rendered component
 */
export function PlanningPoker() {
  // Context and state hooks
  const { queue: ticketsFromQueue, removeFromQueue } = useQueue();
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
  const handleError = useCallback((error: ErrorPayload) => {
    console.error('WebSocket Error:', error);
    setWsError(error.message || 'An unknown WebSocket error occurred.');
    setIsLoading(false);
  }, []);

  // Persist username in localStorage
  useEffect(() => {
    localStorage.setItem('planningPokerUserName', userName);
  }, [userName]);

  // Initialize WebSocket connection
  useEffect(() => {
    setIsLoading(true);
    // Define stable callbacks for connect
    const stableOnSessionUpdate = (updatedSession: PlanningPokerSession) => {
        setSession(updatedSession);
        setWsError(null);
        setIsLoading(false);
    };

    const stableOnError = (error: ErrorPayload) => {
        console.error('WebSocket Error:', error);
        setWsError(error.message || 'An unknown WebSocket error occurred.');
        setIsLoading(false);
    };

    planningPokerWsService.connect(stableOnSessionUpdate, stableOnError)
      .then(() => {
        console.log('Connected to Planning Poker WebSocket.');
        const socketId = planningPokerWsService.getSocketId();
        if (socketId && !myUserId) { // Set myUserId only if not already set
          setMyUserId(socketId);
          console.log('My User ID (Socket ID) set to:', socketId);
        }
        // If session data is available upon connection, it will be handled by stableOnSessionUpdate
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to connect to WS:', err);
        setWsError('Failed to connect to the session server. Please try again.');
        setIsLoading(false);
      });

    return () => {
      planningPokerWsService.disconnect();
      setSession(null); // Clear session on component unmount
    };
  }, []); // Ensure this effect runs only once on mount

  /**
   * Creates a new planning poker session
   */
  const handleCreateSession = () => {
    if (!userName.trim()) {
      setWsError('Please enter your name.');
      return;
    }
    if (ticketsFromQueue.length === 0) {
      setWsError('Please add at least one ticket to the queue before creating a session.');
      return;
    }
    setWsError(null);
    setIsLoading(true);
    // Map FrontendJiraTicket from queue to the structure expected by backend if different
    // For now, assuming they are compatible or backend JiraTicket is a superset
    const backendTickets: FrontendJiraTicket[] = ticketsFromQueue.map(t => {
      // The JiraTicket type from useQueue (originating from jiraService) might not have 'description'.
      // The FrontendJiraTicket for planning poker (from ../types/planningPoker) has 'description' as optional.
      const ticketForPoker: FrontendJiraTicket = {
        key: t.key,
        summary: t.summary,
        // Explicitly set description if it exists on 't', otherwise it will be undefined
        // Casting to `any` to access potentially missing prop. A more robust solution
        // would be to ensure `JiraTicket` from `jiraService` includes an optional `description`
        // or to check its existence more safely.
        description: (t as any).description || undefined,
        url: jiraService.getTicketUrl(t.key), // Use jiraService to build full URL
        type: t.type,
        status: t.status,
      };
      return ticketForPoker;
    });
    planningPokerWsService.createSession(userName.trim(), backendTickets);
  };

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
    planningPokerWsService.joinSession(sessionIdToJoin.trim(), userName.trim());
  };

  /**
   * Removes a ticket from the queue
   * @param ticketKey - The key of the ticket to remove
   */
  const handleRemoveTicketFromQueue = (ticketKey: string) => {
    removeFromQueue(ticketKey);
  };

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
      <Box sx={{ maxWidth: 500, margin: 'auto', p: 3 }}>
        <Typography variant="h4" gutterBottom textAlign="center">
          Planning Poker
        </Typography>
        {wsError && <Alert severity="error" sx={{ mb: 2 }}>{wsError}</Alert>}
        <Paper elevation={3} sx={{ p: 3 }}>
          <TextField
            label="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            fullWidth
            margin="normal"
            disabled={isLoading}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateSession}
            fullWidth
            disabled={isLoading || ticketsFromQueue.length === 0}
            sx={{ mt: 2, mb: 1 }}
          >
            Create New Session
          </Button>
          <Typography variant="caption" display="block" textAlign="center" sx={{mb:1}}>
            (Requires tickets in the PBR Queue below)
          </Typography>
          <hr style={{margin: '20px 0'}}/>
          <TextField
            label="Session ID to Join"
            value={sessionIdToJoin}
            onChange={(e) => setSessionIdToJoin(e.target.value)}
            fullWidth
            margin="normal"
            disabled={isLoading}
          />
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleJoinSession}
            fullWidth
            disabled={isLoading}
            sx={{ mt: 1 }}
          >
            Join Existing Session
          </Button>
        </Paper>

        {/* Ticket Queue Display (kept from original, for creating sessions) */}
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            PBR Queue for New Session ({ticketsFromQueue.length})
          </Typography>
          <List dense>
            {ticketsFromQueue.map((ticket) => (
              <ListItem
                key={ticket.key}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveTicketFromQueue(ticket.key)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${ticket.key}: ${ticket.summary}`}
                  secondary={`Type: ${ticket.type} | Status: ${ticket.status}`}
                />
              </ListItem>
            ))}
            {ticketsFromQueue.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                Add tickets from the Jira Ticket Selector to the queue to include them in a new Planning Poker session.
              </Typography>
            )}
          </List>
        </Paper>
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Planning Poker Session: {session.id}
      </Typography>
      {wsError && <Alert severity="error" sx={{ mb: 2 }}>{wsError}</Alert>}
      <Typography variant="h6">Welcome, {me?.name || userName} {me?.isHost && '(Host)'}</Typography>
      
      <Grid container spacing={2} sx={{mt: 2}}>
        {/* Participants List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{p:2}}>
            <Typography variant="h6">Participants ({session.users.length})</Typography>
            <List dense>
              {session.users.map(user => (
                <ListItem key={user.id}>
                  <ListItemText
                    primary={`${user.name} ${user.id === myUserId ? '(You)' : ''} ${user.isHost ? '[Host]' : ''}`}
                    secondary={
                      session.votesRevealed
                        ? `Voted: ${user.vote || 'N/A'}`
                        : (user.hasVoted ? 'Voted' : 'Waiting to vote...')
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Current Ticket & Voting Area */}
        <Grid item xs={12} md={8}>
          {currentTicket ? (
            <Card>
              <CardContent>
                <Typography variant="h5">{currentTicket.key}: {currentTicket.summary}</Typography>
                {currentTicket.description && <Typography variant="body2" sx={{mt:1, whiteSpace: 'pre-wrap'}}>{currentTicket.description}</Typography>}
                <Button component="a" href={currentTicket.url} target="_blank" rel="noopener noreferrer" sx={{mt:1}}>View in Jira</Button>
                
                {/* Voting UI (placeholder) */}
                <Box sx={{mt: 2}}>
                  <Typography variant="subtitle1">Vote:</Typography>
                  {/* Actual voting buttons/cards will go here */}
                   <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mt:1}}>
                      {FIBONACCI_CARDS.map((cardValue) => (
                        <Button
                          key={cardValue}
                          variant={me?.vote === cardValue ? "contained" : "outlined"}
                          onClick={() => handleVote(cardValue)}
                          disabled={!session.votingOpen || !!me?.hasVoted || session.votesRevealed}
                          sx={{minWidth: '40px', padding: '10px'}}
                        >
                          {cardValue}
                        </Button>
                      ))}
                    </Stack>
                    {me?.hasVoted && !session.votesRevealed && <Typography sx={{mt:1}} variant="body2">Your vote: {me.vote} (Waiting for others...)</Typography>}
                </Box>

                {/* Results Display */}
                {session.votesRevealed && currentTicket && (
                  <Box sx={{mt:3}}>
                    <Typography variant="h6">Voting Results for {currentTicket.key}:</Typography>
                    <List dense>
                      {Object.entries(voteCounts).map(([voteValue, count]) => (
                        <ListItem key={voteValue}>
                          <ListItemText primary={`Vote "${voteValue}": ${count} user(s)`} />
                        </ListItem>
                      ))}
                      {Object.keys(voteCounts).length === 0 && <ListItem><ListItemText primary="No votes were cast." /></ListItem>}
                    </List>
                  </Box>
                )}

              </CardContent>
              <CardActions sx={{justifyContent: 'space-between', p:2, flexWrap: 'wrap', gap: 1}}>
                {/* User status / action prompts */}
                <Box>
                  {!me?.isHost && session.votingOpen && !me?.hasVoted && !session.votesRevealed &&
                    <Typography color="text.secondary">Please cast your vote.</Typography>
                  }
                  {!me?.isHost && session.votingOpen && me?.hasVoted && !session.votesRevealed &&
                    <Typography color="text.secondary">Vote submitted. Waiting for host to reveal.</Typography>
                  }
                   {!me?.isHost && !session.votingOpen && session.votesRevealed && currentTicket &&
                    <Typography color="text.secondary">Voting closed. Waiting for next ticket.</Typography>
                  }
                </Box>
                {/* Host Actions */}
                {me?.isHost && (
                  <Stack direction="row" spacing={1}>
                    {!session.votingOpen && !session.votesRevealed && currentTicket &&
                      <Button variant="contained" onClick={handleStartVoting} disabled={isLoading}>Start Voting for {currentTicket.key}</Button>
                    }
                    {session.votingOpen && !session.votesRevealed &&
                      <Button variant="contained" color="secondary" onClick={handleRevealVotes} disabled={isLoading}>Reveal Votes</Button>
                    }
                    {session.votesRevealed && currentTicket &&
                      <Button variant="contained" onClick={handleNextTicket} disabled={isLoading}>
                        {session.tickets.findIndex(t => t.key === currentTicket.key) < session.tickets.length - 1 ? 'Next Ticket' : 'End Session (No more tickets)'}
                      </Button>
                    }
                  </Stack>
                )}
              </CardActions>
            </Card>
          ) : (
            <Paper sx={{p:2, textAlign: 'center', mt: 2}}>
              <Typography variant="h5" gutterBottom>
                {session.tickets.length > 0 && session.currentTicketKey === null && session.votesRevealed
                  ? 'All tickets have been estimated!'
                  : (session.tickets.length > 0 ? 'Waiting for host to select a ticket or start voting...' : 'No tickets loaded in this session.')
                }
              </Typography>
              {me?.isHost && session.tickets.length > 0 && session.currentTicketKey === null && session.votesRevealed && (
                 <Typography variant="body1">You can review the PBR queue or start a new session.</Typography>
              )}
               {me?.isHost && session.tickets.length === 0 && (
                 <Typography variant="body1">Please add tickets to the PBR queue and create a new session to begin.</Typography>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}