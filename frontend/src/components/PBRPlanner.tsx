import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { confluenceService } from '../services/confluenceService';
import { useQueue } from '../contexts/QueueContext';

export function PBRPlanner() {
  const [pageUrl, setPageUrl] = useState('');
  const { queue: tickets, removeTicketFromGlobalQueue, clearGlobalQueue } = useQueue();
  const [isGeneratingTable, setIsGeneratingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateTable = async () => {
    if (!pageUrl) return;

    try {
      setIsGeneratingTable(true);
      setError(null);
      await confluenceService.generateTable(pageUrl, tickets);
      setPageUrl('');
    } catch (error: any) {
      console.error('Error generating table:', error);
      setError(error.response?.data?.message || error.message || 'Failed to generate Confluence table');
    } finally {
      setIsGeneratingTable(false);
    }
  };

  const handleGeneratePolls = () => {
    // TODO: Implement poll generation
    console.log('Generate polls for tickets:', tickets);
  };

  const handleRemoveTicket = (ticketKey: string) => {
    removeTicketFromGlobalQueue(ticketKey);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        PBR Planning
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Selected Tickets ({tickets.length})
          </Typography>
          {tickets.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              onClick={clearGlobalQueue}
              size="small"
            >
              Clear All
            </Button>
          )}
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

      <Paper sx={{ p: 2 }}>
        <TextField
          fullWidth
          label="Confluence Page URL"
          value={pageUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPageUrl(e.target.value)}
          sx={{ mb: 2 }}
          error={!!error}
          helperText={error}
        />
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleGenerateTable}
            disabled={!pageUrl || tickets.length === 0 || isGeneratingTable}
          >
            {isGeneratingTable ? 'Generating...' : 'Generate PBR Table'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGeneratePolls}
            disabled={tickets.length === 0}
          >
            Generate Polls
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
} 