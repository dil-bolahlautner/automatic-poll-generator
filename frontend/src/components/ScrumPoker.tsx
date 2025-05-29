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
import { Box } from '@mui/material';
import { PlanningPoker } from './PlanningPoker';

/**
 * Main ScrumPoker component that renders the Planning Poker interface
 * @returns React component
 */
export function ScrumPoker() {
  return (
    <Box>
      <PlanningPoker />
    </Box>
  );
}