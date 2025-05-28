/**
 * TeamsPollGenerator Component
 * 
 * A component that generates Microsoft Teams polls for JIRA tickets.
 * It allows users to:
 * - Enter a Teams meeting ID
 * - View the list of tickets to generate polls for
 * - Generate polls for all tickets in the list
 * 
 * The component receives the tickets to generate polls for through the router state.
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

/**
 * Interface representing a JIRA ticket structure
 */
interface JiraTicket {
  key: string;
  fields: {
    summary: string;
  };
}

/**
 * TeamsPollGenerator component for creating Teams polls from JIRA tickets
 * @returns React component
 */
export function TeamsPollGenerator() {
  // Get tickets from router state
  const location = useLocation();
  const [meetingId, setMeetingId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tickets] = useState<JiraTicket[]>(location.state?.tickets || []);

  /**
   * Handles the generation of Teams polls for all tickets
   * Makes an API call to create polls in the specified Teams meeting
   */
  const handleGeneratePolls = async () => {
    try {
      setIsGenerating(true);
      await axios.post('http://localhost:3001/api/teams/generate-polls', {
        meetingId,
        tickets,
      });
    } catch (error) {
      console.error('Error generating Teams polls:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Box>
      {/* Component title */}
      <Typography variant="h4" gutterBottom>
        Teams Poll Generator
      </Typography>

      {/* Meeting ID input and generate button */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Teams Meeting ID"
          value={meetingId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeetingId(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleGeneratePolls}
          disabled={!meetingId || tickets.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Generating Polls...
            </>
          ) : (
            'Generate Polls'
          )}
        </Button>
      </Paper>

      {/* List of tickets to generate polls for */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Tickets to Generate Polls For ({tickets.length})
        </Typography>
        <List>
          {tickets.map((ticket) => (
            <ListItem key={ticket.key}>
              <ListItemText
                primary={ticket.key}
                secondary={ticket.fields.summary}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
} 