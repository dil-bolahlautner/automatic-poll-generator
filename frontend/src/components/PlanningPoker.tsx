/**
 * PlanningPoker Component
 * 
 * A real-time planning poker session component that allows teams to:
 * - Create and join planning poker sessions
 * - Vote on story points using Fibonacci sequence
 * - View real-time voting results and statistics
 * - Manage session flow (start voting, reveal votes, next ticket)
 * 
 * This component has been refactored for better maintainability and readability.
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
  Button,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Avatar,
  TextField,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import GroupIcon from '@mui/icons-material/Group';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import planningPokerWsService from '../services/planningPokerWebsocketService';
import { PlanningPokerSession, JiraTicket as FrontendJiraTicket, ErrorPayload, PlanningPokerUser, SessionTerminatedPayload } from '../types/planningPoker';
import { Theme } from '@mui/material/styles';
import { styled as muiStyled } from '@mui/material/styles';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Constants
const BASE_FIBONACCI_CARDS = ['0', '1/2', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'];

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

const ParticipantsCard = muiStyled(StyledPaper, {
  shouldForwardProp: (prop) => prop !== '$votingStatus',
})<{ $votingStatus?: boolean; theme?: Theme }>(({ $votingStatus, theme }) => ({
  border: $votingStatus ? `2px solid ${theme?.palette.primary.main}` : 'none',
  backgroundColor: $votingStatus ? theme?.palette.primary.light + '10' : 'inherit',
}));

// Utility functions
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getPastelColor = (name: string): string => {
  const colors = [
    '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFB3F7',
    '#B3FFB3', '#B3D9FF', '#FFE6B3', '#E6B3FF', '#B3FFF0'
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Custom hooks for better separation of concerns
const usePlanningPokerSession = () => {
  const [session, setSession] = useState<PlanningPokerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSessionUpdate = useCallback((updatedSession: PlanningPokerSession) => {
    setSession(updatedSession);
    setError(null);
  }, []);

  const handleSessionTerminated = useCallback((terminatedPayload: SessionTerminatedPayload) => {
    setSession(null);
    toast.error(`Session terminated: ${terminatedPayload.reason}`);
  }, []);

  const handleError = useCallback((error: ErrorPayload) => {
    setError(error.message);
    toast.error(error.message);
  }, []);

  return {
    session,
    loading,
    error,
    setSession,
    setLoading,
    setError,
    handleSessionUpdate,
    handleSessionTerminated,
    handleError
  };
};

const useWebSocketConnection = () => {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = useCallback(() => {
    setIsConnected(true);
    toast.success('Connected to planning poker session');
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    toast.error('Disconnected from planning poker session');
  }, []);

  return {
    isConnected,
    handleConnect,
    handleDisconnect
  };
};

const useSessionActions = (session: PlanningPokerSession | null) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCreateSession = useCallback(async () => {
    if (!user?.email) {
      toast.error('Please log in to create a session');
      return;
    }

    try {
      planningPokerWsService.createSession(user.email);
      toast.success('Session created successfully! Share the session ID with your team to invite them.');
    } catch (error) {
      toast.error('Failed to create session');
      console.error('Create session error:', error);
    }
  }, [user?.email]);

  const handleRemoveTicketFromQueue = useCallback((ticketKey: string) => {
    try {
      planningPokerWsService.removeTicketFromQueue(ticketKey);
      toast.success('Ticket removed from queue');
    } catch (error) {
      toast.error('Failed to remove ticket from queue');
      console.error('Remove ticket error:', error);
    }
  }, []);

  const handleStartVoting = useCallback(async () => {
    if (!session?.currentTicketKey || !session?.id) {
      toast.error('No ticket selected for voting');
      return;
    }

    try {
      planningPokerWsService.startVoting(session.id, session.currentTicketKey);
      toast.success('Voting started!');
    } catch (error) {
      toast.error('Failed to start voting');
      console.error('Start voting error:', error);
    }
  }, [session?.currentTicketKey, session?.id]);

  const handleVote = useCallback(async (voteValue: string) => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.submitVote(session.id, voteValue);
      toast.success('Vote submitted!');
    } catch (error) {
      toast.error('Failed to submit vote');
      console.error('Vote error:', error);
    }
  }, [session?.id]);

  const handleRevealVotes = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.revealVotes(session.id);
      toast.success('Votes revealed!');
    } catch (error) {
      toast.error('Failed to reveal votes');
      console.error('Reveal votes error:', error);
    }
  }, [session?.id]);

  const handleNextTicket = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.nextTicket(session.id);
      toast.success('Moving to next ticket');
    } catch (error) {
      toast.error('Failed to move to next ticket');
      console.error('Next ticket error:', error);
    }
  }, [session?.id]);

  const handleClearSession = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.clearSession(session.id);
      toast.success('Session cleared');
    } catch (error) {
      toast.error('Failed to clear session');
      console.error('Clear session error:', error);
    }
  }, [session?.id]);

  const handleCloseSession = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.closeSession(session.id);
      toast.success('Session closed');
      navigate('/');
    } catch (error) {
      toast.error('Failed to close session');
      console.error('Close session error:', error);
    }
  }, [session?.id, navigate]);

  const handleLeaveSession = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.leaveSession(session.id);
      toast.success('Left session');
      navigate('/');
    } catch (error) {
      toast.error('Failed to leave session');
      console.error('Leave session error:', error);
    }
  }, [session?.id, navigate]);

  const handleTransferHost = useCallback(async (newHostId: string) => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.transferHost(session.id, newHostId);
      toast.success('Host transferred');
    } catch (error) {
      toast.error('Failed to transfer host');
      console.error('Transfer host error:', error);
    }
  }, [session?.id]);

  const handleRestartVoting = useCallback(async () => {
    if (!session?.id) {
      toast.error('No active session');
      return;
    }

    try {
      planningPokerWsService.restartVoting(session.id);
      toast.success('Voting restarted');
    } catch (error) {
      toast.error('Failed to restart voting');
      console.error('Restart voting error:', error);
    }
  }, [session?.id]);

  const handleSetFinalEstimation = useCallback(async (estimationValue: string) => {
    if (!session?.id || !session?.currentTicketKey) {
      toast.error('No active session or ticket');
      return;
    }

    try {
      planningPokerWsService.setFinalEstimation(session.id, session.currentTicketKey, estimationValue);
      toast.success(`Final estimation set: ${estimationValue} story points`);
    } catch (error) {
      toast.error('Failed to set final estimation');
      console.error('Set final estimation error:', error);
    }
  }, [session?.id, session?.currentTicketKey]);

  return {
    handleCreateSession,
    handleRemoveTicketFromQueue,
    handleStartVoting,
    handleVote,
    handleRevealVotes,
    handleNextTicket,
    handleClearSession,
    handleCloseSession,
    handleLeaveSession,
    handleTransferHost,
    handleRestartVoting,
    handleSetFinalEstimation
  };
};

// Sub-components for better organization

const CurrentTicketDisplay = ({ 
  ticket, 
  votingOpen, 
  votesRevealed,
  discussionPhase
}: { 
  ticket: FrontendJiraTicket; 
  votingOpen: boolean; 
  votesRevealed: boolean; 
  discussionPhase: boolean;
}) => (
  <StyledPaper>
    <Typography variant="h6" gutterBottom>
      Current Ticket
    </Typography>
    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
      <Typography variant="h5" gutterBottom>
        <Button
          variant="text"
          href={ticket.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            textTransform: 'none', 
            p: 0, 
            minWidth: 'auto',
            color: 'inherit',
            textDecoration: 'underline',
            '&:hover': {
              textDecoration: 'underline',
              backgroundColor: 'transparent'
            }
          }}
        >
          {ticket.key}
        </Button>
      </Typography>
      <Typography variant="body1" paragraph>
        {ticket.summary}
      </Typography>
      
      {/* Jira URL Link */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          href={ticket.url}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
          sx={{ textTransform: 'none' }}
        >
          Open in Jira
        </Button>
      </Box>
      
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip 
          label={ticket.type} 
          size="small" 
          color="primary" 
        />
        <Chip 
          label={ticket.status} 
          size="small" 
          color="secondary" 
        />
        {votingOpen && (
          <Chip 
            label="Voting in progress" 
            size="small" 
            color="success" 
          />
        )}
        {votesRevealed && !discussionPhase && (
          <Chip 
            label="Votes revealed" 
            size="small" 
            color="warning" 
          />
        )}
        {discussionPhase && (
          <Chip 
            label="Discussion phase" 
            size="small" 
            color="error" 
          />
        )}
      </Stack>
    </Box>
  </StyledPaper>
);

const SessionHeader = ({ session, isConnected }: { session: PlanningPokerSession; isConnected: boolean }) => {
  const handleCopySessionId = () => {
    navigator.clipboard.writeText(session.id);
    toast.success('Session ID copied to clipboard!');
  };

  const currentTicket = session.currentTicketKey 
    ? session.tickets.find(ticket => ticket.key === session.currentTicketKey)
    : null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" gutterBottom>
        Planning Poker Session
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Chip
          label={`Session ID: ${session.id}`}
          color="primary"
          variant="outlined"
          onClick={handleCopySessionId}
          sx={{ cursor: 'pointer' }}
          title="Click to copy session ID"
        />
        <Chip
          label={isConnected ? 'Connected' : 'Disconnected'}
          color={isConnected ? 'success' : 'error'}
          size="small"
        />
        <Typography variant="body2" color="text.secondary">
          {session.users.length} participants
        </Typography>
        {currentTicket && (
          <Chip
            label={`Current: ${currentTicket.key}`}
            color="secondary"
            size="small"
            title={currentTicket.summary}
            onClick={() => window.open(currentTicket.url, '_blank', 'noopener,noreferrer')}
            sx={{ cursor: 'pointer' }}
          />
        )}
        {session.votingOpen && (
          <Chip
            label="Voting Open"
            color="success"
            size="small"
          />
        )}
      </Stack>
    </Box>
  );
};

const ParticipantsList = ({ users }: { users: PlanningPokerUser[] }) => (
  <ParticipantsCard $votingStatus={false}>
    <Typography variant="h6" gutterBottom>
      <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
      Participants
    </Typography>
    <List dense>
      {users.map((user) => (
        <ListItem key={user.id}>
          <Avatar
            sx={{
              bgcolor: getPastelColor(user.name),
              mr: 2,
              width: 32,
              height: 32,
              fontSize: '0.8rem'
            }}
          >
            {getInitials(user.name)}
          </Avatar>
          <ListItemText
            primary={user.name}
            secondary={
              user.isHost ? 'Host' : 
              user.hasVoted ? 'Voted' : 'Waiting to vote'
            }
          />
          <ListItemSecondaryAction>
            {user.isHost && <Chip label="Host" size="small" color="primary" />}
            {user.hasVoted && !user.isHost && <Chip label="✓" size="small" color="success" />}
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  </ParticipantsCard>
);

const VotingCards = ({ 
  onVote, 
  currentUser, 
  votingOpen, 
  votesRevealed,
  discussionPhase
}: { 
  onVote: (vote: string) => void; 
  currentUser: PlanningPokerUser; 
  votingOpen: boolean; 
  votesRevealed: boolean; 
  discussionPhase: boolean;
}) => (
  <StyledPaper>
    <Typography variant="h6" gutterBottom>
      <CasinoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
      Story Points
    </Typography>
    {discussionPhase && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Discussion Phase:</strong> No consensus reached. You can change your vote or the host can set a final estimation.
        </Typography>
      </Alert>
    )}
    <Grid container spacing={1} justifyContent="center">
      {BASE_FIBONACCI_CARDS.map((card) => (
        <Grid item key={card}>
          <VoteButton
            variant={currentUser.vote === card ? 'contained' : 'outlined'}
            color={currentUser.vote === card ? 'primary' : 'inherit'}
            onClick={() => onVote(card)}
            disabled={!votingOpen && !discussionPhase}
            sx={{
              minWidth: card === '?' || card === '☕' ? '80px' : '60px',
              fontSize: card === '?' || card === '☕' ? '1rem' : '1.2rem'
            }}
          >
            {card}
          </VoteButton>
        </Grid>
      ))}
    </Grid>
  </StyledPaper>
);

const ActionButtons = ({ 
  session, 
  currentUser, 
  onStartVoting, 
  onRevealVotes, 
  onNextTicket, 
  onClearSession, 
  onCloseSession, 
  onLeaveSession,
  onRestartVoting,
  onSetFinalEstimation
}: { 
  session: PlanningPokerSession; 
  currentUser: PlanningPokerUser; 
  onStartVoting: () => void; 
  onRevealVotes: () => void; 
  onNextTicket: () => void; 
  onClearSession: () => void; 
  onCloseSession: () => void; 
  onLeaveSession: () => void; 
  onRestartVoting: () => void;
  onSetFinalEstimation: (estimation: string) => void;
}) => {
  // Determine which buttons to show based on session state
  const showStartVoting = currentUser.isHost && !session.votingOpen && !session.votesRevealed && session.currentTicketKey && session.tickets.length > 0;
  const showRevealVotes = currentUser.isHost && session.votingOpen && !session.votesRevealed;
  const showRestartVoting = currentUser.isHost && session.discussionPhase && !session.votingOpen;
  const showNextTicket = currentUser.isHost && (session.votesRevealed || session.finalEstimations[session.currentTicketKey!]);
  const showFinalEstimation = currentUser.isHost && session.discussionPhase && !session.votingOpen;

  return (
    <StyledPaper>
      <Typography variant="h6" gutterBottom>
        Session Actions
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {currentUser.isHost && (
          <>
            {showStartVoting && (
              <ActionButton
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={onStartVoting}
              >
                Start Voting
              </ActionButton>
            )}
            {showRevealVotes && (
              <ActionButton
                variant="contained"
                color="secondary"
                startIcon={<VisibilityIcon />}
                onClick={onRevealVotes}
              >
                Reveal Votes
              </ActionButton>
            )}
            {showRestartVoting && (
              <ActionButton
                variant="contained"
                color="warning"
                startIcon={<PlayArrowIcon />}
                onClick={onRestartVoting}
              >
                Restart Voting
              </ActionButton>
            )}
            {showNextTicket && (
              <ActionButton
                variant="contained"
                color="info"
                startIcon={<NavigateNextIcon />}
                onClick={onNextTicket}
                disabled={session.tickets.length === 0}
              >
                Next Ticket
              </ActionButton>
            )}
            {showFinalEstimation && (
              <Stack direction="row" spacing={1}>
                {BASE_FIBONACCI_CARDS.filter(card => card !== '?' && card !== '☕').map((estimation) => (
                  <ActionButton
                    key={estimation}
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => onSetFinalEstimation(estimation)}
                  >
                    {estimation}
                  </ActionButton>
                ))}
              </Stack>
            )}
            <ActionButton
              variant="outlined"
              color="warning"
              onClick={onClearSession}
            >
              Clear Session
            </ActionButton>
            <ActionButton
              variant="outlined"
              color="error"
              onClick={onCloseSession}
            >
              Close Session
            </ActionButton>
          </>
        )}
        <ActionButton
          variant="outlined"
          color="inherit"
          onClick={onLeaveSession}
        >
          Leave Session
        </ActionButton>
      </Stack>
    </StyledPaper>
  );
};

const VotingResults = ({ 
  session
}: { 
  session: PlanningPokerSession; 
  currentUser?: PlanningPokerUser; 
}) => {
  if (!session.votesRevealed && !session.discussionPhase) {
    return null;
  }

  const votes = session.users
    .filter(user => user.vote)
    .map(user => ({ name: user.name, vote: user.vote! }));

  // Filter out '?' and '☕' votes for result calculation
  const validVotes = votes.filter(({ vote }) => vote !== '?' && vote !== '☕');
  const invalidVotes = votes.filter(({ vote }) => vote === '?' || vote === '☕');

  // Group valid votes by story point value
  const votesByStoryPoint = validVotes.reduce((acc, { name, vote }) => {
    if (!acc[vote]) {
      acc[vote] = [];
    }
    acc[vote].push(name);
    return acc;
  }, {} as Record<string, string[]>);

  // Group invalid votes separately
  const invalidVotesByType = invalidVotes.reduce((acc, { name, vote }) => {
    if (!acc[vote]) {
      acc[vote] = [];
    }
    acc[vote].push(name);
    return acc;
  }, {} as Record<string, string[]>);

  const hasConsensus = Object.keys(votesByStoryPoint).length === 1 && Object.keys(votesByStoryPoint).length > 0;
  const finalEstimation = session.finalEstimations[session.currentTicketKey!];

  return (
    <StyledPaper>
      <Typography variant="h6" gutterBottom>
        Voting Results
      </Typography>
      <Box sx={{ mb: 2 }}>
        {/* Valid Votes */}
        {Object.keys(votesByStoryPoint).length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 600 }}>
              Valid Votes
            </Typography>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {Object.entries(votesByStoryPoint)
                .sort(([a], [b]) => {
                  // Sort story points in logical order (0, 1/2, 1, 2, 3, 5, 8, 13, 20, 40, 100)
                  const order = ['0', '1/2', '1', '2', '3', '5', '8', '13', '20', '40', '100'];
                  const aIndex = order.indexOf(a);
                  const bIndex = order.indexOf(b);
                  return aIndex - bIndex;
                })
                .map(([storyPoint, voters]) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={storyPoint}>
                    <Box sx={{ 
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        borderColor: 'primary.light'
                      }
                    }}>
                      {/* Header */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        mb: 2,
                        pb: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 700,
                            color: 'primary.main',
                            fontSize: '1.25rem'
                          }}
                        >
                          {storyPoint}SP
                        </Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }}>
                          {voters.length}
                        </Box>
                      </Box>
                      
                      {/* Voters */}
                      <Stack spacing={1}>
                        {voters.map((voterName) => (
                          <Box
                            key={voterName}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              py: 0.5
                            }}
                          >
                            <Box sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              mr: 1.5,
                              opacity: 0.7
                            }} />
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: 'text.secondary',
                                fontSize: '0.875rem'
                              }}
                            >
                              {voterName.split('@')[0]}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Grid>
                ))}
            </Grid>
          </>
        )}

        {/* Invalid Votes (?, ☕) */}
        {Object.keys(invalidVotesByType).length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 600 }}>
              Abstentions
            </Typography>
            <Grid container spacing={3}>
              {Object.entries(invalidVotesByType)
                .sort(([a], [b]) => {
                  const order = ['?', '☕'];
                  const aIndex = order.indexOf(a);
                  const bIndex = order.indexOf(b);
                  return aIndex - bIndex;
                })
                .map(([voteType, voters]) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={voteType}>
                    <Box sx={{ 
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                      opacity: 0.7
                    }}>
                      {/* Header */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        mb: 2,
                        pb: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 700,
                            color: 'text.secondary',
                            fontSize: '1.25rem'
                          }}
                        >
                          {voteType === '?' ? 'Pass' : 'Break'}
                        </Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: 'text.secondary',
                          color: 'white',
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }}>
                          {voters.length}
                        </Box>
                      </Box>
                      
                      {/* Voters */}
                      <Stack spacing={1}>
                        {voters.map((voterName) => (
                          <Box
                            key={voterName}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              py: 0.5
                            }}
                          >
                            <Box sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'text.secondary',
                              mr: 1.5,
                              opacity: 0.5
                            }} />
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 500,
                                color: 'text.secondary',
                                fontSize: '0.875rem'
                              }}
                            >
                              {voterName.split('@')[0]}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Grid>
                ))}
            </Grid>
          </>
        )}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        {hasConsensus && (
          <Chip 
            label="Consensus reached!" 
            color="success" 
            size="small" 
          />
        )}
        {!hasConsensus && session.discussionPhase && (
          <Chip 
            label="No consensus - discuss and vote again" 
            color="warning" 
            size="small" 
          />
        )}
        {finalEstimation && (
          <Chip 
            label={`Final: ${finalEstimation} story points`} 
            color="primary" 
            size="small" 
          />
        )}
      </Stack>
    </StyledPaper>
  );
};

const EstimatedItemsList = ({ finalEstimations, tickets }: { finalEstimations: Record<string, string>; tickets: FrontendJiraTicket[] }) => {
  if (Object.keys(finalEstimations).length === 0) {
    return (
      <StyledPaper>
        <Typography variant="h6" gutterBottom>
          Final Estimations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No estimations have been finalized yet.
        </Typography>
      </StyledPaper>
    );
  }

  return (
    <StyledPaper>
      <Typography variant="h6" gutterBottom>
        Final Estimations
      </Typography>
      <List>
        {tickets.map((ticket) => {
          const estimation = finalEstimations[ticket.key];
          if (!estimation) return null;

          return (
            <ListItem key={ticket.key} divider>
              <ListItemText
                primary={ticket.key}
                secondary={ticket.summary}
              />
              <ListItemSecondaryAction>
                <Chip
                  label={estimation}
                  color="primary"
                  variant="outlined"
                />
              </ListItemSecondaryAction>
            </ListItem>
          );
        })}
      </List>
    </StyledPaper>
  );
};

// Join Session Form Component
const JoinSessionForm = () => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedSessionId = sessionId.trim();
    
    if (!trimmedSessionId) {
      toast.error('Please enter a session ID');
      return;
    }

    if (trimmedSessionId.length < 3) {
      toast.error('Session ID must be at least 3 characters long');
      return;
    }

    if (!user?.email) {
      toast.error('Please log in to join a session');
      return;
    }

    setIsJoining(true);
    try {
      planningPokerWsService.joinSession(trimmedSessionId, user.email);
      toast.success('Joining session...');
    } catch (error) {
      toast.error('Failed to join session');
      console.error('Join session error:', error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleJoinSession}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Ask the session host for the session ID. You can find it displayed at the top of their planning poker screen.
        </Typography>
        <TextField
          fullWidth
          label="Session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="e.g., abc123-def456"
          disabled={isJoining}
          required
          helperText="Enter the session ID provided by the host"
        />
        <Button
          type="submit"
          variant="outlined"
          size="large"
          disabled={!user?.email || isJoining}
          startIcon={<GroupIcon />}
          fullWidth
        >
          {isJoining ? 'Joining...' : 'Join Session'}
        </Button>
      </Stack>
    </Box>
  );
};

// Main component
export function PlanningPoker() {
  const { user } = useAuth();
  const { sessionId } = useParams();

  // Custom hooks
  const {
    session,
    loading,
    error,
    setSession
  } = usePlanningPokerSession();

  const {
    isConnected,
    handleConnect,
    handleDisconnect
  } = useWebSocketConnection();

  const {
    handleCreateSession,
    handleStartVoting,
    handleVote,
    handleRevealVotes,
    handleNextTicket,
    handleClearSession,
    handleCloseSession,
    handleLeaveSession,
    handleRestartVoting,
    handleSetFinalEstimation
  } = useSessionActions(session);

  // WebSocket event handlers
  useEffect(() => {
    const handleSessionUpdate = (updatedSession: PlanningPokerSession) => {
      setSession(updatedSession);
    };

    const handleSessionTerminated = (terminatedPayload: SessionTerminatedPayload) => {
      setSession(null);
      toast.error(`Session terminated: ${terminatedPayload.reason}`);
    };

    const handleError = (error: ErrorPayload) => {
      toast.error(error.message);
    };

    planningPokerWsService.onSessionUpdate(handleSessionUpdate);
    planningPokerWsService.onSessionTerminated(handleSessionTerminated);
    planningPokerWsService.onError(handleError);

    return () => {
      planningPokerWsService.offSessionUpdate(handleSessionUpdate);
      planningPokerWsService.offSessionTerminated(handleSessionTerminated);
      planningPokerWsService.offError(handleError);
    };
  }, [setSession]);

  // Connection status
  useEffect(() => {
    planningPokerWsService.onConnected(handleConnect);
    planningPokerWsService.onDisconnected(handleDisconnect);

    return () => {
      planningPokerWsService.offConnected(handleConnect);
      planningPokerWsService.offDisconnected(handleDisconnect);
    };
  }, [handleConnect, handleDisconnect]);

  // Join session if sessionId is provided
  useEffect(() => {
    if (sessionId && user?.email) {
      planningPokerWsService.joinSession(sessionId, user.email);
    }
  }, [sessionId, user?.email]);

  // Show success message when session is first created
  const [showSessionCreatedMessage, setShowSessionCreatedMessage] = useState(false);
  
  useEffect(() => {
    if (session && !sessionId) {
      // Session was created (not joined via URL)
      setShowSessionCreatedMessage(true);
      // Hide message after 10 seconds
      const timer = setTimeout(() => setShowSessionCreatedMessage(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [session, sessionId]);

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  // No session state
  if (!session) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <StyledPaper>
          <Typography variant="h4" gutterBottom>
            Planning Poker
          </Typography>
          <Typography variant="body1" paragraph>
            Create a new planning poker session or join an existing one to start estimating story points with your team.
          </Typography>
          
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Create New Session
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Start a new planning poker session and invite your team to join.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleCreateSession}
                disabled={!user?.email}
                startIcon={<CasinoIcon />}
                fullWidth
              >
                Create Session
              </Button>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>
                Join Existing Session
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Join an existing planning poker session using the session ID.
              </Typography>
              <JoinSessionForm />
            </Box>
          </Stack>
        </StyledPaper>
      </Box>
    );
  }

  // Find current user
  const currentUser = session.users.find(u => u.name === user?.email);
  if (!currentUser) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2 }}>
        <Alert severity="error">
          You are not a participant in this session.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {showSessionCreatedMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setShowSessionCreatedMessage(false)}
        >
          <Typography variant="body1" gutterBottom>
            <strong>Session created successfully!</strong>
          </Typography>
          <Typography variant="body2">
            Share the session ID above with your team members so they can join. 
            They can click on the session ID to copy it to their clipboard.
          </Typography>
        </Alert>
      )}
      
      <SessionHeader session={session} isConnected={isConnected} />
      
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            {session.currentTicketKey && (
              <CurrentTicketDisplay 
                ticket={session.tickets.find(t => t.key === session.currentTicketKey)!}
                votingOpen={session.votingOpen}
                votesRevealed={session.votesRevealed}
                discussionPhase={session.discussionPhase}
              />
            )}
            
            <VotingCards
              onVote={handleVote}
              currentUser={currentUser}
              votingOpen={session.votingOpen}
              votesRevealed={session.votesRevealed}
              discussionPhase={session.discussionPhase}
            />
            
            <VotingResults
              session={session}
              currentUser={currentUser}
            />
            
            <ActionButtons
              session={session}
              currentUser={currentUser}
              onStartVoting={handleStartVoting}
              onRevealVotes={handleRevealVotes}
              onNextTicket={handleNextTicket}
              onClearSession={handleClearSession}
              onCloseSession={handleCloseSession}
              onLeaveSession={handleLeaveSession}
              onRestartVoting={handleRestartVoting}
              onSetFinalEstimation={handleSetFinalEstimation}
            />
            
            <EstimatedItemsList
              finalEstimations={session.finalEstimations}
              tickets={session.tickets}
            />
          </Stack>
        </Grid>

                 {/* Right Column */}
         <Grid item xs={12} md={4}>
           <Stack spacing={3}>
             <ParticipantsList users={session.users} />
           </Stack>
         </Grid>
      </Grid>
    </Box>
  );
}