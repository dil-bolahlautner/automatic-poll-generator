import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  IconButton,
  Chip,
} from '@mui/material';
import { useQueue } from '../contexts/QueueContext';
import { confluenceService } from '../services/confluenceService';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { jiraService } from '../services/jiraService';

export const PBRQueue: React.FC = () => {
  const { queue, removeTicketFromGlobalQueue } = useQueue();
  const [isConfluenceDialogOpen, setIsConfluenceDialogOpen] = useState(false);
  const [confluencePageUrl, setConfluencePageUrl] = useState('');
  const [isGeneratingTable, setIsGeneratingTable] = useState(false);
  const [confluenceError, setConfluenceError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get distinct reporters from the queue
  const distinctReporters = useMemo(() => {
    const reporters = new Set<string>();
    queue.forEach(ticket => {
      if (ticket.reporter) {
        reporters.add(ticket.reporter);
      }
    });
    return Array.from(reporters).sort();
  }, [queue]);

  const handleCopyReporters = () => {
    const reportersText = distinctReporters.map(reporter => `@${reporter}`).join(' ');
    navigator.clipboard.writeText(reportersText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleGenerateTable = async () => {
    if (!confluencePageUrl) return;

    try {
      setIsGeneratingTable(true);
      setConfluenceError(null);
      await confluenceService.generateTable(confluencePageUrl, queue);
      setIsConfluenceDialogOpen(false);
      setConfluencePageUrl('');
    } catch (error: any) {
      console.error('Error generating table:', error);
      setConfluenceError(error.response?.data?.message || error.message || 'Failed to generate Confluence table');
    } finally {
      setIsGeneratingTable(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">PBR Planning Queue</Typography>
          <Button
            variant="contained"
            onClick={() => setIsConfluenceDialogOpen(true)}
            disabled={queue.length === 0}
          >
            Generate Confluence Table
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Labels</TableCell>
                <TableCell>Fix Versions</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((ticket) => (
                <TableRow key={ticket.key}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <a
                        href={jiraService.getTicketUrl(ticket.key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        {ticket.key}
                      </a>
                      <OpenInNewIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    </Box>
                  </TableCell>
                  <TableCell>{ticket.summary}</TableCell>
                  <TableCell>{ticket.type}</TableCell>
                  <TableCell>{ticket.status}</TableCell>
                  <TableCell>{ticket.labels?.join(', ') || ''}</TableCell>
                  <TableCell>
                    {ticket.fixVersions?.map(v => v.name).join(', ') || ''}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeTicketFromGlobalQueue(ticket.key)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Reporters section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Ticket Reporters ({distinctReporters.length})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyReporters}
            size="small"
          >
            {copySuccess ? 'Copied!' : 'Copy for Teams'}
          </Button>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1,
          '& .MuiChip-root': {
            height: 32,
            fontSize: '0.875rem'
          }
        }}>
          {distinctReporters.map((reporter) => (
            <Chip
              key={reporter}
              label={reporter}
              variant="outlined"
              color="primary"
            />
          ))}
        </Box>
      </Paper>

      <Dialog 
        open={isConfluenceDialogOpen} 
        onClose={() => !isGeneratingTable && setIsConfluenceDialogOpen(false)}
      >
        <DialogTitle>Generate Confluence Table</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Confluence Page URL"
            type="url"
            fullWidth
            value={confluencePageUrl}
            onChange={(e) => setConfluencePageUrl(e.target.value)}
            disabled={isGeneratingTable}
            error={!!confluenceError}
            helperText={confluenceError}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setIsConfluenceDialogOpen(false);
              setConfluenceError(null);
            }} 
            disabled={isGeneratingTable}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerateTable} 
            variant="contained"
            disabled={!confluencePageUrl || isGeneratingTable}
          >
            {isGeneratingTable ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={!!confluenceError} 
        autoHideDuration={6000} 
        onClose={() => setConfluenceError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setConfluenceError(null)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {confluenceError}
        </Alert>
      </Snackbar>
    </Box>
  );
}; 