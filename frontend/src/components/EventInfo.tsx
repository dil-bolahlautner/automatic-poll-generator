/**
 * EventInfo Component
 * 
 * Displays information about a Planning Poker event, including:
 * - Event name
 * - Number of participants
 * - List of participants with visual distinction for the current user
 * 
 * This component provides a clear overview of the event's participants
 * and helps users identify their role in the session.
 */

import { Box, Paper, Typography, Chip, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { EstimationEvent, User } from '../types/estimation';

/**
 * Styled chip component for participant display
 * Customizes the appearance of participant chips with consistent spacing and font weight
 */
const StyledChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  '& .MuiChip-label': {
    fontWeight: 500,
  },
}));

/**
 * Props for the EventInfo component
 */
interface EventInfoProps {
  /** The estimation event to display information for */
  event: EstimationEvent;
  /** The current user participating in the event */
  currentUser: User;
}

/**
 * EventInfo component that displays event details and participant information
 * @param props - EventInfoProps containing event and current user data
 * @returns React component
 */
export function EventInfo({ event, currentUser }: EventInfoProps) {
  return (
    <Box>
      {/* Event name display */}
      <Typography variant="h4" gutterBottom>
        {event.name}
      </Typography>

      {/* Participant count with icon */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="body1" color="text.secondary">
          {event.participants.length} Participants
        </Typography>
      </Box>

      {/* List of participants as chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {event.participants.map((participant) => (
          <StyledChip
            key={participant.id}
            label={participant.name}
            color={participant.id === currentUser.id ? 'primary' : 'default'}
            variant={participant.id === currentUser.id ? 'filled' : 'outlined'}
          />
        ))}
      </Box>
    </Box>
  );
} 