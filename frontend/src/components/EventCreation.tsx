import React, { useState, useEffect } from 'react';
import { useEstimation } from '../contexts/EstimationContext';
import { websocketService } from '../services/websocketService';
import { Box, Paper, Typography, TextField, Button, Alert, Fade, Tab, Tabs } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import LoginIcon from '@mui/icons-material/Login';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupIcon from '@mui/icons-material/Group';

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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

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

export function EventCreation() {
  const { state, dispatch } = useEstimation();
  const [eventName, setEventName] = useState('');
  const [userName, setUserName] = useState('');
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const handleEventCreated = (message: any) => {
      if (message.type === 'EVENT_CREATED') {
        dispatch({
          type: 'SET_CURRENT_EVENT',
          payload: message.payload.event
        });
      }
    };

    const handleError = (message: any) => {
      if (message.type === 'ERROR' || message.type === 'REGISTRATION_ERROR') {
        setError(message.payload.message || message.payload.error);
      }
    };

    // const unsubscribe = websocketService.subscribe((message) => {
    //   handleEventCreated(message);
    //   handleError(message);
    // });
    // return () => unsubscribe();
    console.warn("EventCreation: Old websocketService.subscribe() call commented out.");
    return () => {}; // Return an empty function for cleanup
  }, [dispatch]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !userName.trim()) {
      setError('Please enter both event name and your name');
      return;
    }

    try {
      const userId = crypto.randomUUID();
      // await websocketService.connect(userId, true);
      // await websocketService.registerUser(userId, userName);
      // await websocketService.createEvent(eventName);
      console.warn("EventCreation: Old websocketService calls in handleCreateEvent commented out.");
      setError('Event creation is temporarily disabled.'); // Inform user
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId.trim() || !userName.trim()) {
      setError('Please enter both event ID and your name');
      return;
    }

    try {
      const userId = crypto.randomUUID();
      // await websocketService.connect(userId, false);
      // await websocketService.registerUser(userId, userName);
      // await websocketService.joinEvent(eventId);
      console.warn("EventCreation: Old websocketService calls in handleJoinEvent commented out.");
      setError('Joining events is temporarily disabled.'); // Inform user
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join event');
    }
  };

  if (state.currentEvent) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <StyledPaper elevation={3}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Planning Poker
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create a new estimation event or join an existing one
          </Typography>
        </Box>

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            mb: 3,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<AddIcon />}
            label="Create Event"
            iconPosition="start"
            sx={{ textTransform: 'none' }}
          />
          <Tab
            icon={<LoginIcon />}
            label="Join Event"
            iconPosition="start"
            sx={{ textTransform: 'none' }}
          />
        </Tabs>

        <Fade in={!!error}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        </Fade>

        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleCreateEvent}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <StyledTextField
                label="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                fullWidth
                required
                InputProps={{
                  startAdornment: <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <StyledTextField
                label="Event Name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Enter event name"
                fullWidth
                required
                InputProps={{
                  startAdornment: <EmojiEventsIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <ActionButton
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                startIcon={<AddIcon />}
              >
                Create Event
              </ActionButton>
            </Box>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <form onSubmit={handleJoinEvent}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <StyledTextField
                label="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                fullWidth
                required
                InputProps={{
                  startAdornment: <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <StyledTextField
                label="Event ID"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="Enter event ID"
                fullWidth
                required
                InputProps={{
                  startAdornment: <LoginIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <ActionButton
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<LoginIcon />}
              >
                Join Event
              </ActionButton>
            </Box>
          </form>
        </TabPanel>
      </StyledPaper>
    </Box>
  );
} 