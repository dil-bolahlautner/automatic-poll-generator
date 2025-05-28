import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
// import { EventCreation } from './EventCreation'; // No longer directly used here
// import { EstimationRoom } from './EstimationRoom'; // No longer directly used here
// import { useEstimation } from '../contexts/EstimationContext'; // May not be needed if PlanningPoker manages its own state
import { PlanningPoker } from './PlanningPoker'; // Import the new Planning Poker component

export function ScrumPoker() {
  // const { state } = useEstimation(); // This context might be part of the old system

  return (
    <Box sx={{ py: 4 }}>
      {/* The descriptive paper can remain if desired, or be removed if PlanningPoker handles its own title */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Planning Poker Session
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Create or join a real-time Planning Poker session with your team.
        </Typography>
      </Paper>

      {/* Render the new PlanningPoker component directly */}
      <PlanningPoker />
    </Box>
  );
}