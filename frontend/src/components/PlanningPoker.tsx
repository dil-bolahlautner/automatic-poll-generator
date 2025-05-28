import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQueue } from '../contexts/QueueContext';
import { teamsService } from '../services/teamsService';

const FIBONACCI_CARDS = ['1', '2', '3', '5', '8', '13', '20', '?'];

export function PlanningPoker() {
  const { queue: tickets, removeFromQueue } = useQueue();
  const [isGeneratingPolls, setIsGeneratingPolls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState('');

  const handleGeneratePolls = async () => {
    if (!pollTitle) return;

    try {
      setIsGeneratingPolls(true);
      setError(null);

      // Generate a poll for each ticket
      for (const ticket of tickets) {
        const pollQuestion = `${ticket.key}: ${ticket.summary}\n\nHow many story points?`;
        await teamsService.createPoll(pollTitle, pollQuestion, FIBONACCI_CARDS);
      }

      setIsDialogOpen(false);
      setPollTitle('');
    } catch (error: any) {
      console.error('Error generating polls:', error);
      setError(error.response?.data?.message || error.message || 'Failed to generate polls');
    } finally {
      setIsGeneratingPolls(false);
    }
  };

  const handleRemoveTicket = (ticketKey: string) => {
    removeFromQueue(ticketKey);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Planning Poker
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Selected Tickets ({tickets.length})
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsDialogOpen(true)}
            disabled={tickets.length === 0}
          >
            Generate Polls
          </Button>
        </Box>
        <List>
          {tickets.map((ticket) => (
            <ListItem key={ticket.key}>
              <ListItemText
                primary={`${ticket.key}: ${ticket.summary}`}
                secondary={`Type: ${ticket.type} | Status: ${ticket.status}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleRemoveTicket(ticket.key)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog 
        open={isDialogOpen} 
        onClose={() => !isGeneratingPolls && setIsDialogOpen(false)}
      >
        <DialogTitle>Generate Planning Poker Polls</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Poll Title"
            fullWidth
            value={pollTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPollTitle(e.target.value)}
            disabled={isGeneratingPolls}
            error={!!error}
            helperText={error || "Enter a title for the polls (e.g., 'Sprint 42 Planning Poker')"}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Available Cards:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {FIBONACCI_CARDS.map((card) => (
                <Paper
                  key={card}
                  sx={{
                    p: 1,
                    minWidth: 40,
                    textAlign: 'center',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  {card}
                </Paper>
              ))}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setIsDialogOpen(false);
              setError(null);
            }} 
            disabled={isGeneratingPolls}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGeneratePolls} 
            variant="contained"
            disabled={!pollTitle || isGeneratingPolls}
          >
            {isGeneratingPolls ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 