import React, { useEffect } from 'react';
import { useEstimation } from '../contexts/EstimationContext';
import { websocketService } from '../services/websocketService';
import { EventInfo } from './EventInfo';
import { Box, Paper, Typography, Button, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';

const FIBONACCI_NUMBERS: (number | '?')[] = [1, 2, 3, 5, 8, 13, 21, '?'];

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: theme.spacing(2),
  background: 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1.5, 3),
  textTransform: 'none',
  fontSize: '1rem',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

const VoteButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  minWidth: '80px',
  fontSize: '1.2rem',
  fontWeight: 'bold',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

export function EstimationRoom() {
  const { state, dispatch } = useEstimation();
  const { currentEvent, currentUser } = state;

  useEffect(() => {
    if (!currentEvent || !currentUser) return;

    const handleEventUpdate = (message: any) => {
      if (message.type === 'EVENT_UPDATED') {
        dispatch({
          type: 'SET_CURRENT_EVENT',
          payload: message.payload.event
        });
      }
    };

    const unsubscribe = websocketService.subscribe(handleEventUpdate);
    return () => unsubscribe();
  }, [currentEvent, currentUser, dispatch]);

  if (!currentEvent || !currentUser) {
    return null;
  }

  const currentTicket = currentEvent.tickets[currentEvent.currentTicketIndex];
  const isHost = currentUser.isHost;

  const handleVote = async (vote: number | '?') => {
    if (!currentTicket) return;
    await websocketService.sendVote(currentTicket.key, vote);
  };

  const handleStartVoting = async () => {
    if (!currentTicket) return;
    await websocketService.startVoting(currentTicket.key);
  };

  const handleCloseVoting = async () => {
    if (!currentTicket) return;
    await websocketService.closeVoting(currentTicket.key);
  };

  const handleRestartVoting = async () => {
    if (!currentTicket) return;
    await websocketService.restartVoting(currentTicket.key);
  };

  const handleLeaveEvent = async () => {
    await websocketService.leaveEvent(currentEvent.id);
    dispatch({ type: 'RESET_EVENT' });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      <StyledPaper elevation={3}>
        <EventInfo event={currentEvent} currentUser={currentUser} />

        {currentTicket && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Current Ticket: {currentTicket.key}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {currentTicket.summary}
            </Typography>

            {isHost && (
              <Box sx={{ mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item>
                    <ActionButton
                      variant="contained"
                      color="primary"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleStartVoting}
                      disabled={currentTicket.status === 'voting'}
                    >
                      Start Voting
                    </ActionButton>
                  </Grid>
                  <Grid item>
                    <ActionButton
                      variant="contained"
                      color="secondary"
                      startIcon={<StopIcon />}
                      onClick={handleCloseVoting}
                      disabled={currentTicket.status !== 'voting'}
                    >
                      Close Voting
                    </ActionButton>
                  </Grid>
                  <Grid item>
                    <ActionButton
                      variant="outlined"
                      color="primary"
                      startIcon={<RefreshIcon />}
                      onClick={handleRestartVoting}
                      disabled={currentTicket.status !== 'closed'}
                    >
                      Restart Voting
                    </ActionButton>
                  </Grid>
                </Grid>
              </Box>
            )}

            {currentTicket.status === 'voting' && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Cast Your Vote
                </Typography>
                <Grid container spacing={2} justifyContent="center">
                  {FIBONACCI_NUMBERS.map((number) => (
                    <Grid item key={number}>
                      <VoteButton
                        variant="contained"
                        color="primary"
                        onClick={() => handleVote(number)}
                      >
                        {number}
                      </VoteButton>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {currentTicket.status === 'closed' && currentTicket.result && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Voting Results
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="subtitle1">Average</Typography>
                    <Typography variant="h4">{currentTicket.result.average.toFixed(1)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="subtitle1">Median</Typography>
                    <Typography variant="h4">{currentTicket.result.median}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="subtitle1">Mode</Typography>
                    <Typography variant="h4">{currentTicket.result.mode}</Typography>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ mt: 4, textAlign: 'right' }}>
          <ActionButton
            variant="outlined"
            color="error"
            startIcon={<ExitToAppIcon />}
            onClick={handleLeaveEvent}
          >
            Leave Event
          </ActionButton>
        </Box>
      </StyledPaper>
    </Box>
  );
} 