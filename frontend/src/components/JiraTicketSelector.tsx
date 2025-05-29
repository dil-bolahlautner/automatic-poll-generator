/**
 * JiraTicketSelector Component
 * 
 * A comprehensive ticket management interface that allows users to:
 * - View and filter JIRA tickets
 * - Select tickets for PBR planning or estimation
 * - Generate Confluence tables
 * - Add tickets to the PBR queue
 * - Sort and filter tickets by various criteria
 */

import React, { useState, useMemo, useEffect } from 'react'; // Added useEffect
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  IconButton,
  Link,
  Checkbox,
  Button,
  TableSortLabel,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { useJira } from '../contexts/JiraContext';
import { JiraTicket as JiraServiceTicket, FixVersion, jiraService, Sprint } from '../services/jiraService'; // Renamed to avoid conflict, added Sprint
import { JiraTicket as PokerJiraTicket } from '../types/planningPoker'; // For the queue
import { planningPokerWsService } from '../services/planningPokerWebsocketService'; // Import the service
import { usePersistedState } from '../hooks/usePersistedState';
import { confluenceService } from '../services/confluenceService';
import { useSelectedTickets } from '../contexts/SelectedTicketsContext';
import { useQueue } from '../contexts/QueueContext';
import { useNavigate } from 'react-router-dom';
import { SelectChangeEvent } from '@mui/material';

// Type definitions for sorting and table headers
type Order = 'asc' | 'desc';

interface HeadCell {
  id: keyof JiraServiceTicket | 'milestone'; // Use JiraServiceTicket for table head
  label: string;
  sortable: boolean;
  filterable: boolean;
  filterType: 'text' | 'select' | 'none';
}

// Define table column headers with their properties
const headCells: HeadCell[] = [
  { id: 'key', label: 'Key', sortable: true, filterable: true, filterType: 'text' },
  { id: 'summary', label: 'Summary', sortable: true, filterable: true, filterType: 'text' },
  { id: 'labels', label: 'Labels', sortable: false, filterable: true, filterType: 'select' },
  { id: 'milestone', label: 'Milestone', sortable: true, filterable: true, filterType: 'select' },
  { id: 'status', label: 'Status', sortable: true, filterable: true, filterType: 'select' },
  { id: 'fixVersions', label: 'Fix Versions', sortable: false, filterable: true, filterType: 'select' },
  { id: 'blockingIssues', label: 'Depending on', sortable: false, filterable: false, filterType: 'none' }
];

/**
 * Main component for JIRA ticket selection and management
 * @returns {JSX.Element} The rendered component
 */
export const JiraTicketSelector: React.FC = () => {
  // Context and state hooks
  const { tickets = [], total = 0, fixVersions = [], isLoading, error: jiraError } = useJira();
  const [selectedVersions, setSelectedVersions] = usePersistedState<string[]>('selectedVersions', []);
  const [isVersionsExpanded, setIsVersionsExpanded] = usePersistedState<boolean>('isVersionsExpanded', false);
  const { selectedTickets, setSelectedTickets } = useSelectedTickets(); // This context might also need review if it stores tickets for long
  const { queue, addTicketsToGlobalQueue } = useQueue(); // Use the new method name
  const [selectedTicketKeys, setSelectedTicketKeys] = useState<Set<string>>(new Set());
  const [orderBy, setOrderBy] = usePersistedState<keyof JiraServiceTicket | 'milestone'>('orderBy', 'key'); // Use JiraServiceTicket
  const [order, setOrder] = usePersistedState<Order>('order', 'asc');
  const [filters, setFilters] = usePersistedState<Record<string, string>>('filters', {});
  const [isConfluenceDialogOpen, setIsConfluenceDialogOpen] = useState(false);
  const [confluencePageUrl, setConfluencePageUrl] = useState('');
  const [isGeneratingTable, setIsGeneratingTable] = useState(false);
  const [confluenceError, setConfluenceError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [isWsConnected, setIsWsConnected] = useState<boolean>(planningPokerWsService.isConnected());

  useEffect(() => {
    // Check connection status periodically
    // This is a simple way to react to connection changes without complex event plumbing
    // from the service for this specific component's need.
    const intervalId = setInterval(() => {
      const currentWsStatus = planningPokerWsService.isConnected();
      if (currentWsStatus !== isWsConnected) {
        setIsWsConnected(currentWsStatus);
      }
    }, 1000); // Check every second

    return () => {
      clearInterval(intervalId); // Cleanup on component unmount
    };
  }, [isWsConnected]);

  /**
   * Toggles the selection of a fix version and clears filters
   * @param versionId - The ID of the version to toggle
   */
  const handleVersionToggle = (versionId: string) => {
    setSelectedVersions((prev: string[]) => {
      const newSelection = prev.includes(versionId)
        ? prev.filter((id: string) => id !== versionId)
        : [...prev, versionId];
      
      // Clear filters when fix versions selection changes
      setFilters({});
      
      return newSelection;
    });
  };

  /**
   * Handles the selection/deselection of a ticket
   * @param ticketKey - The key of the ticket to toggle
   */
  const handleTicketSelect = (ticketKey: string) => {
    if (queue.some(t => t.key === ticketKey)) return;

    const ticket = tickets.find(t => t.key === ticketKey);
    if (!ticket) return;
    
    const isSelected = selectedTickets.some(t => t.key === ticketKey);
    setSelectedTickets(
      isSelected 
        ? selectedTickets.filter(t => t.key !== ticketKey)
        : [...selectedTickets, ticket]
    );
  };

  /**
   * Toggles selection of all visible tickets
   */
  const handleSelectAll = () => {
    if (selectedTicketKeys.size === tickets.length) {
      setSelectedTicketKeys(new Set());
    } else {
      setSelectedTicketKeys(new Set(tickets.map(ticket => ticket.key)));
    }
  };

  /**
   * Handles sorting of tickets by a specific property
   * @param property - The property to sort by
   */
  const handleRequestSort = (property: keyof JiraServiceTicket | 'milestone') => { // Use JiraServiceTicket
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  /**
   * Handles changes to select-type filters
   * @param property - The property being filtered
   */
  const handleFilterChange = (property: string) => (event: SelectChangeEvent<string>) => {
    setFilters(prev => ({
      ...prev,
      [property]: event.target.value
    }));
  };

  /**
   * Handles changes to text-type filters
   * @param property - The property being filtered
   */
  const handleTextFilterChange = (property: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFilters(prev => ({
      ...prev,
      [property]: event.target.value
    }));
  };

  /**
   * Extracts milestone information from ticket parent summary
   * @param ticket - The ticket to extract milestone from
   * @returns The milestone value or 'N/A' if not found
   */
  const getMilestoneValue = (ticket: JiraServiceTicket) => { // Use JiraServiceTicket
    if (!ticket.parent) return 'N/A';
    const match = ticket.parent.summary.match(/\[(M[^\]]*)\]/);
    return match ? match[1] : 'NM';
  };

  /**
   * Gets distinct values for dropdown filters based on currently filtered tickets
   * @param tickets - The tickets to analyze
   * @returns Object containing arrays of distinct values for each filter type
   */
  const getDistinctValues = (tickets: JiraServiceTicket[]) => { // Use JiraServiceTicket
    const values: Record<string, Set<string>> = {
      milestone: new Set(),
      status: new Set(),
      fixVersions: new Set(),
      labels: new Set()
    };

    tickets.forEach(ticket => {
      // Milestone values
      values.milestone.add(getMilestoneValue(ticket));
      
      // Status values
      values.status.add(ticket.status);
      
      // Fix Version values
      ticket.fixVersions.forEach(version => {
        values.fixVersions.add(version.name);
      });

      // Label values
      ticket.labels.forEach(label => {
        values.labels.add(label);
      });
    });

    return {
      milestone: Array.from(values.milestone).sort(),
      status: Array.from(values.status).sort(),
      fixVersions: Array.from(values.fixVersions).sort(),
      labels: Array.from(values.labels).sort()
    } as const;
  };

  // Filter tickets based on selected versions
  const versionFilteredTickets = useMemo(() => {
    if (selectedVersions.length === 0) {
      return tickets;
    }
    return tickets.filter(ticket => 
      ticket.fixVersions.some(version => selectedVersions.includes(version.id))
    );
  }, [tickets, selectedVersions]);

  // Get distinct values for dropdowns based on version-filtered tickets
  const distinctValues = useMemo(() => 
    getDistinctValues(versionFilteredTickets),
    [versionFilteredTickets]
  );

  // Apply filters and sorting to tickets
  const filteredTickets = useMemo(() => {
    let result = versionFilteredTickets;
    
    // Apply filters
    Object.entries(filters).forEach(([property, value]) => {
      if (!value) return;
      
      result = result.filter(ticket => {
        if (property === 'milestone') {
          const milestoneValue = getMilestoneValue(ticket);
          return milestoneValue === value;
        }
        if (property === 'fixVersions') {
          return ticket.fixVersions.some(v => v.name === value);
        }
        if (property === 'status') {
          return ticket.status === value;
        }
        if (property === 'labels') {
          const selectedLabels = value.split(',');
          return selectedLabels.some(label => ticket.labels.includes(label));
        }
        const fieldValue = ticket[property as keyof JiraServiceTicket]; // Use JiraServiceTicket
        return String(fieldValue).toLowerCase().includes(value.toLowerCase());
      });
    });

    // Apply sorting
    result = [...result].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (orderBy === 'milestone') {
        aValue = getMilestoneValue(a);
        bValue = getMilestoneValue(b);
      } else {
        aValue = String(a[orderBy as keyof JiraServiceTicket]); // Use JiraServiceTicket
        bValue = String(b[orderBy as keyof JiraServiceTicket]); // Use JiraServiceTicket
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [versionFilteredTickets, filters, orderBy, order]);

  const handleGenerateTable = async () => {
    if (!confluencePageUrl) return;

    try {
      setIsGeneratingTable(true);
      setConfluenceError(null);
      const selectedTicketsList = filteredTickets.filter(ticket => selectedTicketKeys.has(ticket.key));
      await confluenceService.generateTable(confluencePageUrl, selectedTicketsList);
      setIsConfluenceDialogOpen(false);
      setConfluencePageUrl('');
    } catch (error: any) {
      console.error('Error generating table:', error);
      setConfluenceError(error.response?.data?.message || error.message || 'Failed to generate Confluence table');
    } finally {
      setIsGeneratingTable(false);
    }
  };

  const handleAddToPBRQueue = () => {
    const rawSelectedTickets = filteredTickets.filter(ticket => selectedTicketKeys.has(ticket.key));
    
    // Transform to PokerJiraTicket, ensuring 'url' is present and other fields match
    const ticketsForPokerQueue: PokerJiraTicket[] = rawSelectedTickets.map(ticket => ({
      key: ticket.key,
      summary: ticket.summary,
      description: (ticket as any).description || undefined, // Assuming description might be missing on JiraServiceTicket
      url: jiraService.getTicketUrl(ticket.key), // Populate the URL
      type: ticket.type,
      status: ticket.status,
      // Ensure other optional fields from PokerJiraTicket are handled if necessary
    }));

    addTicketsToGlobalQueue(ticketsForPokerQueue);
    setSelectedTicketKeys(new Set()); // Clear local selection after adding to global queue
  };

  const isInQueue = (ticketKey: string) => {
    return queue.some(ticket => ticket.key === ticketKey);
  };

  const handleSelectTicket = (ticketKey: string) => {
    const newSelected = new Set(selectedTicketKeys);
    if (newSelected.has(ticketKey)) {
      newSelected.delete(ticketKey);
    } else {
      newSelected.add(ticketKey);
    }
    setSelectedTicketKeys(newSelected);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (jiraError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading tickets: {jiraError}
      </Alert>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No tickets found. Please check your JIRA configuration.
      </Alert>
    );
  }

  return (
    <Box>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 1,
          position: 'sticky',
          top: 0,
          backgroundColor: 'background.paper',
          zIndex: 1,
          py: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 },
          px: { xs: 1, sm: 2 }
        }}
      >
        <Typography variant="h5" sx={{ 
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          Available Fix Versions
          {selectedVersions.length > 0 && ` (${selectedVersions.length} selected)`}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-end' },
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {selectedTickets.length} tickets selected
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSelectAll}
            fullWidth={false}
          >
            {selectedTicketKeys.size === filteredTickets.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleAddToPBRQueue}
            disabled={selectedTicketKeys.size === 0 || !isWsConnected}
            fullWidth={false}
          >
            Add to PBR Queue
          </Button>
          <IconButton 
            onClick={() => setIsVersionsExpanded(!isVersionsExpanded)}
            size="small"
          >
            {isVersionsExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Box>
      </Box>
      
      <Collapse in={isVersionsExpanded}>
        <ToggleButtonGroup
          value={selectedVersions}
          onChange={(_: React.SyntheticEvent, newValue: string[]) => setSelectedVersions(newValue)}
          aria-label="fix versions"
          sx={{ 
            mb: 3, 
            flexWrap: 'wrap', 
            gap: 1,
            justifyContent: { xs: 'center', sm: 'flex-start' },
            px: { xs: 1, sm: 2 }
          }}
        >
          {fixVersions.map((version: FixVersion) => (
            <ToggleButton
              key={version.id}
              value={version.id}
              selected={selectedVersions.includes(version.id)}
              onClick={() => handleVersionToggle(version.id)}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '16px !important',
                '&.Mui-selected': {
                  backgroundColor: version.released ? 'success.main' : 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: version.released ? 'success.dark' : 'primary.dark',
                  }
                }
              }}
            >
              {version.name}
              {version.released && ' (Released)'}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Collapse>

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 },
        px: { xs: 1, sm: 2 }
      }}>
        <Typography variant="h5" sx={{ 
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          Tickets {selectedVersions.length > 0 && `(${filteredTickets.length} filtered)`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Showing {filteredTickets.length} of {total} total tickets
        </Typography>
      </Box>

      <TableContainer 
        component={Paper}
        sx={{
          maxWidth: '100%',
          overflowX: 'auto',
          '& .MuiTable-root': {
            minWidth: 650,
            tableLayout: 'fixed'
          },
          mx: { xs: 1, sm: 2 },
          mb: 2
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ width: '48px' }}>
                <Checkbox
                  checked={selectedTicketKeys.size === filteredTickets.length && filteredTickets.length > 0}
                  indeterminate={selectedTicketKeys.size > 0 && selectedTicketKeys.size < filteredTickets.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              {headCells.map((headCell) => (
                <TableCell 
                  key={headCell.id}
                  sx={{
                    backgroundColor: 'grey.100',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    width: headCell.id === 'key' ? '120px' :
                           headCell.id === 'summary' ? '30%' :
                           headCell.id === 'labels' ? '15%' :
                           headCell.id === 'milestone' ? '100px' :
                           headCell.id === 'status' ? '100px' :
                           headCell.id === 'fixVersions' ? '15%' :
                           headCell.id === 'blockingIssues' ? '80px' : 'auto',
                    minWidth: headCell.id === 'key' ? '100px' :
                             headCell.id === 'summary' ? '200px' :
                             headCell.id === 'labels' ? '120px' :
                             headCell.id === 'milestone' ? '80px' :
                             headCell.id === 'status' ? '80px' :
                             headCell.id === 'fixVersions' ? '120px' :
                             headCell.id === 'blockingIssues' ? '80px' : 'auto',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      backgroundColor: 'grey.200'
                    },
                    px: { xs: 1, sm: 2 },
                    py: 1,
                    height: '80px'
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    height: '100%',
                    justifyContent: 'space-between'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      gap: 0.5,
                      fontWeight: 'bold',
                      color: 'text.primary',
                      minHeight: '32px',
                      wordBreak: 'normal',
                      whiteSpace: 'normal',
                      fontSize: '0.875rem'
                    }}>
                      {headCell.sortable ? (
                        <TableSortLabel
                          active={orderBy === headCell.id}
                          direction={orderBy === headCell.id ? order : 'asc'}
                          onClick={() => handleRequestSort(headCell.id)}
                          sx={{
                            '&.MuiTableSortLabel-root': {
                              fontWeight: 'bold',
                              color: 'text.primary',
                              '&:hover': {
                                color: 'primary.main'
                              },
                              whiteSpace: 'normal',
                              lineHeight: 1.2,
                              fontSize: '0.875rem',
                              wordBreak: 'normal'
                            },
                            '&.MuiTableSortLabel-root.Mui-active': {
                              color: 'primary.main',
                              '& .MuiTableSortLabel-icon': {
                                color: 'primary.main'
                              }
                            }
                          }}
                        >
                          {headCell.label}
                        </TableSortLabel>
                      ) : (
                        <Typography
                          sx={{
                            fontWeight: 'bold',
                            whiteSpace: 'normal',
                            lineHeight: 1.2,
                            fontSize: '0.875rem',
                            wordBreak: 'normal'
                          }}
                        >
                          {headCell.label}
                        </Typography>
                      )}
                    </Box>
                    {headCell.filterable && (
                      <Box sx={{ 
                        minWidth: 120,
                        '& .MuiSelect-select': {
                          py: 0.5
                        },
                        '& .MuiTextField-root': {
                          '& .MuiInputBase-root': {
                            py: 0.5
                          }
                        }
                      }}>
                        {headCell.filterType === 'select' ? (
                          headCell.id === 'labels' ? (
                            <Select
                              multiple
                              value={filters[headCell.id] ? filters[headCell.id].split(',') : []}
                              onChange={(event) => {
                                const value = (event.target.value as string[]).join(',');
                                setFilters(prev => ({
                                  ...prev,
                                  [headCell.id]: value
                                }));
                              }}
                              displayEmpty
                              size="small"
                              sx={{ 
                                minWidth: 120,
                                '& .MuiSelect-select': {
                                  py: 0.5
                                }
                              }}
                              renderValue={(selected) => {
                                if (selected.length === 0) {
                                  return <em>All</em>;
                                }
                                return selected.join(', ');
                              }}
                            >
                              {distinctValues[headCell.id as keyof typeof distinctValues]?.map((value: string) => (
                                <MenuItem key={value} value={value}>
                                  {value}
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Select
                              value={filters[headCell.id] || ''}
                              onChange={handleFilterChange(headCell.id)}
                              displayEmpty
                              size="small"
                              sx={{ 
                                minWidth: 120,
                                '& .MuiSelect-select': {
                                  py: 0.5
                                }
                              }}
                            >
                              <MenuItem value="">
                                <em>All</em>
                              </MenuItem>
                              {distinctValues[headCell.id as keyof typeof distinctValues]?.map((value: string) => (
                                <MenuItem key={value} value={value}>
                                  {value}
                                </MenuItem>
                              ))}
                            </Select>
                          )
                        ) : (
                          <TextField
                            size="small"
                            placeholder={`Filter ${headCell.label}`}
                            value={filters[headCell.id] || ''}
                            onChange={handleTextFilterChange(headCell.id)}
                            variant="standard"
                            sx={{
                              '& .MuiInputBase-root': {
                                py: 0.5,
                                fontSize: '0.875rem'
                              },
                              '& .MuiInput-underline:before': {
                                borderBottom: 'none'
                              },
                              '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
                                borderBottom: 'none'
                              },
                              '& .MuiInput-underline:after': {
                                borderBottom: 'none'
                              }
                            }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket: JiraServiceTicket) => {
              const isInQueue = queue.some(t => t.key === ticket.key);
              return (
                <TableRow 
                  key={ticket.key}
                  selected={selectedTicketKeys.has(ticket.key)}
                  hover
                  sx={{
                    backgroundColor: ticket.type === 'Bug' 
                      ? 'rgba(255, 0, 0, 0.1)' 
                      : isInQueue 
                        ? 'rgba(0, 0, 0, 0.04)' 
                        : 'inherit',
                    '&:hover': {
                      backgroundColor: ticket.type === 'Bug' 
                        ? 'rgba(255, 0, 0, 0.15)' 
                        : isInQueue
                          ? 'rgba(0, 0, 0, 0.08)'
                          : undefined
                    },
                    opacity: isInQueue ? 0.6 : 1
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTicketKeys.has(ticket.key)}
                      onChange={() => handleSelectTicket(ticket.key)}
                      disabled={isInQueue}
                    />
                  </TableCell>
                  <TableCell sx={{ 
                    width: '120px',
                    minWidth: '100px',
                    maxWidth: '120px'
                  }}>
                    <Link
                      href={jiraService.getTicketUrl(ticket.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline'
                        },
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                    >
                      {ticket.key}
                      <OpenInNewIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    </Link>
                  </TableCell>
                  <TableCell sx={{ 
                    width: '30%',
                    minWidth: '200px',
                    '& > *': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}>
                    {ticket.summary}
                  </TableCell>
                  <TableCell sx={{ 
                    width: '15%',
                    minWidth: '120px'
                  }}>
                    <Stack 
                      direction="row" 
                      spacing={0.5} 
                      flexWrap="wrap" 
                      useFlexGap
                      sx={{ 
                        gap: { xs: 0.5, sm: 1 },
                        '& .MuiChip-root': {
                          height: { xs: 24, sm: 32 },
                          fontSize: { xs: '0.75rem', sm: '0.875rem' }
                        }
                      }}
                    >
                      {ticket.labels.map((label: string) => (
                        <Chip
                          key={label}
                          label={label}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ 
                    width: '100px',
                    minWidth: '80px'
                  }}>
                    {ticket.parent ? (
                      (() => {
                        const match = ticket.parent.summary.match(/\[(M[^\]]*)\]/);
                        if (match) {
                          return (
                            <Link
                              href={jiraService.getTicketUrl(ticket.parent.key)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline'
                                },
                                fontSize: { xs: '0.875rem', sm: '1rem' }
                              }}
                            >
                              {match[1]}
                              <OpenInNewIcon fontSize="small" sx={{ opacity: 0.7 }} />
                            </Link>
                          );
                        } else {
                          return (
                            <Link
                              href={jiraService.getTicketUrl(ticket.parent.key)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline'
                                },
                                fontSize: { xs: '0.875rem', sm: '1rem' }
                              }}
                            >
                              NM
                              <OpenInNewIcon fontSize="small" sx={{ opacity: 0.7 }} />
                            </Link>
                          );
                        }
                      })()
                    ) : (
                      <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ 
                    width: '100px',
                    minWidth: '80px'
                  }}>
                    <Chip
                      label={ticket.status}
                      size="small"
                      color={ticket.status === 'To Do' ? 'default' : 'primary'}
                      sx={{
                        height: { xs: 24, sm: 32 },
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ 
                    width: '15%',
                    minWidth: '120px'
                  }}>
                    <Stack 
                      direction="row" 
                      spacing={0.5}
                      sx={{ 
                        gap: { xs: 0.5, sm: 1 },
                        '& .MuiChip-root': {
                          height: { xs: 24, sm: 32 },
                          fontSize: { xs: '0.75rem', sm: '0.875rem' }
                        }
                      }}
                    >
                      {ticket.fixVersions.map((version: FixVersion) => (
                        <Chip
                          key={version.id}
                          label={version.name}
                          size="small"
                          variant="outlined"
                          color={version.released ? 'success' : 'default'}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ 
                    width: '80px',
                    minWidth: '80px',
                    maxWidth: '120px'
                  }}>
                    <Stack 
                      direction="row" 
                      spacing={0.5} 
                      flexWrap="wrap" 
                      useFlexGap
                      sx={{ 
                        gap: { xs: 0.5, sm: 1 },
                        '& .MuiLink-root': {
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }
                      }}
                    >
                      {ticket.blockingIssues.map((blocking: { key: string; summary: string; status: string; type: string; }) => (
                        <Link
                          key={blocking.key}
                          href={jiraService.getTicketUrl(blocking.key)}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            textDecoration: 'none',
                            color: 'error.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          {blocking.key}
                          <OpenInNewIcon fontSize="small" sx={{ opacity: 0.7 }} />
                        </Link>
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfluencePageUrl(e.target.value)}
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

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 },
        px: { xs: 1, sm: 2 }
      }}>
        <Typography variant="h5" sx={{ 
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}>
          Select Tickets for Estimation
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 },
          flexWrap: 'wrap',
          justifyContent: { xs: 'center', sm: 'flex-end' },
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Button
            variant="outlined"
            onClick={handleSelectAll}
            disabled={filteredTickets.length === 0}
            fullWidth={false}
          >
            {selectedTicketKeys.size === filteredTickets.length ? 'Deselect All' : 'Select All'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}; 