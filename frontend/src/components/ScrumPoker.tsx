import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { EventCreation } from './EventCreation';
import { EstimationRoom } from './EstimationRoom';
import { useEstimation } from '../contexts/EstimationContext';

export function ScrumPoker() {
  const { state } = useEstimation();

  return (
    <Box sx={{ py: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Scrum Poker
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Create or join an estimation event to start planning poker with your team.
        </Typography>
      </Paper>

      {!state.currentEvent ? (
        <EventCreation />
      ) : (
        <EstimationRoom />
      )}
    </Box>
  );
} 