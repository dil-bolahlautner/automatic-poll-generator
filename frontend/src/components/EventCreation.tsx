/**
 * EventCreation Component
 * 
 * Allows users to create new estimation events or join existing ones.
 * Provides a tabbed interface for event creation and joining functionality.
 */

import { useState } from 'react';
import { useEstimation } from '../contexts/EstimationContext';
import { Box, Paper, Typography, TextField, Button, Alert, Tab, Tabs } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import LoginIcon from '@mui/icons-material/Login';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: theme.spacing(2),
  background: 'linear-gradient(145deg, #ffffff 0%, #f5f7fa 100%)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1),
    transition: 'all 0.3s ease',
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
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

// Types
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * TabPanel component for tabbed interface
 */
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Main EventCreation component
 */
export function EventCreation() {
  const { dispatch } = useEstimation();
  const [eventName, setEventName] = useState('');
  const [userName, setUserName] = useState('');
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  /**
   * Handles tab change in the interface
   */
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null); // Clear errors when switching tabs
  };

  /**
   * Handles event creation form submission
   */
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventName.trim() || !userName.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      // Generate a unique event ID
      const newEventId = crypto.randomUUID();
      
      // Create the event
      const event = {
        id: newEventId,
        name: eventName.trim(),
        hostId: newEventId,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        currentTicketIndex: 0,
        tickets: [],
        participants: [{
          id: newEventId,
          name: userName.trim(),
          isHost: true
        }]
      };

      // Update the estimation context
      dispatch({
        type: 'SET_CURRENT_EVENT',
        payload: event
      });

      // Clear form
      setEventName('');
      setUserName('');
      setError(null);
    } catch (error) {
      setError('Failed to create event. Please try again.');
      console.error('Create event error:', error);
    }
  };

  /**
   * Handles event joining form submission
   */
  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventId.trim() || !userName.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      // For now, we'll create a mock event since the old WebSocket service is not available
      const event = {
        id: eventId.trim(),
        name: `Event ${eventId.trim()}`,
        hostId: 'mock-host-id',
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        currentTicketIndex: 0,
        tickets: [],
        participants: [{
          id: crypto.randomUUID(),
          name: userName.trim(),
          isHost: false
        }]
      };

      // Update the estimation context
      dispatch({
        type: 'SET_CURRENT_EVENT',
        payload: event
      });

      // Clear form
      setEventId('');
      setUserName('');
      setError(null);
    } catch (error) {
      setError('Failed to join event. Please try again.');
      console.error('Join event error:', error);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
      <StyledPaper>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Estimation Event
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create a new estimation event or join an existing one
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab 
              icon={<AddIcon />} 
              label="Create Event" 
              iconPosition="start"
            />
            <Tab 
              icon={<LoginIcon />} 
              label="Join Event" 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Create Event Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box component="form" onSubmit={handleCreateEvent}>
            <Typography variant="h6" gutterBottom>
              <GroupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Create New Event
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a new estimation event and invite your team to join
            </Typography>
            
            <StyledTextField
              fullWidth
              label="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              sx={{ mb: 3 }}
              required
            />
            
            <StyledTextField
              fullWidth
              label="Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Enter event name"
              sx={{ mb: 3 }}
              required
            />
            
            <ActionButton
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              startIcon={<AddIcon />}
            >
              Create Event
            </ActionButton>
          </Box>
        </TabPanel>

        {/* Join Event Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box component="form" onSubmit={handleJoinEvent}>
            <Typography variant="h6" gutterBottom>
              <LoginIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Join Existing Event
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join an existing estimation event using the event ID
            </Typography>
            
            <StyledTextField
              fullWidth
              label="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              sx={{ mb: 3 }}
              required
            />
            
            <StyledTextField
              fullWidth
              label="Event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Enter event ID"
              sx={{ mb: 3 }}
              required
            />
            
            <ActionButton
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              startIcon={<LoginIcon />}
            >
              Join Event
            </ActionButton>
          </Box>
        </TabPanel>
      </StyledPaper>
    </Box>
  );
} 