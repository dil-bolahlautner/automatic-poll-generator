/**
 * ScrumPoker Component
 * 
 * A wrapper component that provides the main entry point for Planning Poker functionality.
 * It displays a descriptive header and renders the core PlanningPoker component.
 * 
 * This component serves as a container for the Planning Poker feature, providing:
 * - A title and description for the Planning Poker session
 * - A clean layout for the PlanningPoker component
 * - A consistent user interface structure
 */

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
// import { EventCreation } from './EventCreation'; // No longer directly used here
// import { EstimationRoom } from './EstimationRoom'; // No longer directly used here
// import { useEstimation } from '../contexts/EstimationContext'; // May not be needed if PlanningPoker manages its own state
import { PlanningPoker } from './PlanningPoker'; // Import the new Planning Poker component

/**
 * Main ScrumPoker component that renders the Planning Poker interface
 * @returns React component
 */
export function ScrumPoker() {
  // const { state } = useEstimation(); // This context might be part of the old system

  return (
    <Box sx={{ py: 4 }}>
      {/* Header section with title and description */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Planning Poker Session
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Create or join a real-time Planning Poker session with your team.
        </Typography>
      </Paper>

      {/* Core Planning Poker functionality */}
      <PlanningPoker />
    </Box>
  );
}