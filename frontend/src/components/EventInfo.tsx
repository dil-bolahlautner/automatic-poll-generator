import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import { EstimationEvent, User } from '../types/estimation';

const StyledChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  '& .MuiChip-label': {
    fontWeight: 500,
  },
}));

interface EventInfoProps {
  event: EstimationEvent;
  currentUser: User;
}

export function EventInfo({ event, currentUser }: EventInfoProps) {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {event.name}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="body1" color="text.secondary">
          {event.participants.length} Participants
        </Typography>
      </Box>
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