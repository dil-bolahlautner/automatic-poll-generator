import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Paper,
  Button,
  Grid,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Link as MuiLink,
  IconButton,
  Tooltip
} from '@mui/material';
import { LibraryAdd as LibraryAddIcon, Article as ArticleIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { jiraService, Sprint, JiraTicket } from '../services/jiraService';
import { confluenceService, RetroTopic } from '../services/confluenceService'; // Import confluence service and RetroTopic

interface Topic {
  id: string;
  title: string;
  owner: string;
  epics: EpicWithTickets[];
}

interface EpicWithTickets {
  epicKey: string;
  epicSummary: string;
  tickets: JiraTicket[];
}

interface GroupedTickets {
  [epicKey: string]: EpicWithTickets;
}

const RetroPresentation: React.FC = () => {
  const [sprintSearchQuery, setSprintSearchQuery] = useState<string>('');
  const [searchedSprints, setSearchedSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [sprintTickets, setSprintTickets] = useState<JiraTicket[]>([]);
  const [groupedTickets, setGroupedTickets] = useState<GroupedTickets>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingSprints, setLoadingSprints] = useState<boolean>(false);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for the new workflow: selecting epics then creating a topic for them
  const [selectedEpicKeysForNewTopicCreation, setSelectedEpicKeysForNewTopicCreation] = useState<Set<string>>(new Set());
  const [isCreateTopicModalOpen, setIsCreateTopicModalOpen] = useState<boolean>(false);
  const [newTopicTitleForSelectedEpics, setNewTopicTitleForSelectedEpics] = useState<string>('');
  const [newTopicOwnerForSelectedEpics, setNewTopicOwnerForSelectedEpics] = useState<string>('');

  // State for Confluence Page Generation
  const [confluencePageUrl, setConfluencePageUrl] = useState<string>('');
  const [isGeneratingConfluencePage, setIsGeneratingConfluencePage] = useState<boolean>(false);
  const [confluenceSuccessMessage, setConfluenceSuccessMessage] = useState<string | null>(null);
  const [confluenceErrorMessage, setConfluenceErrorMessage] = useState<string | null>(null);
  const [generatedConfluenceViewUrl, setGeneratedConfluenceViewUrl] = useState<string | null>(null);

  const handleSearchSprints = useCallback(async () => {
    if (!sprintSearchQuery.trim()) {
      setSearchedSprints([]);
      return;
    }
    setLoadingSprints(true);
    setError(null);
    try {
      const sprints = await jiraService.searchSprints(sprintSearchQuery);
      setSearchedSprints(sprints);
    } catch (err: any) {
      console.error('Error searching sprints:', err);
      setError(err.message || 'Failed to search sprints.');
    } finally {
      setLoadingSprints(false);
    }
  }, [sprintSearchQuery]);

  useEffect(() => {
    // Simplified: Search on button click via handleSearchSprints
  }, [sprintSearchQuery, handleSearchSprints]);

  const handleSelectSprint = async (sprint: Sprint) => {
    setSelectedSprint(sprint);
    setSearchedSprints([]);
    setSprintSearchQuery('');
    setLoadingTickets(true);
    setError(null);
    try {
      const response = await jiraService.getTicketsForSprint(String(sprint.id));
      setSprintTickets(response.tickets);
      setSelectedEpicKeysForNewTopicCreation(new Set()); // Clear selections on new sprint load
      setTopics([]); // Clear existing topics when a new sprint is selected
    } catch (err: any) {
      console.error('Error fetching sprint tickets:', err);
      setError(err.message || 'Failed to fetch sprint tickets.');
      setSprintTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (sprintTickets.length > 0) {
      const groups: GroupedTickets = sprintTickets.reduce((acc, ticket) => {
        const epicKey = ticket.parent?.key || 'NO_EPIC';
        const epicSummary = ticket.parent?.summary || 'Tickets without Epic';
        
        if (!acc[epicKey]) {
          acc[epicKey] = { epicKey, epicSummary, tickets: [] };
        }
        acc[epicKey].tickets.push(ticket);
        return acc;
      }, {} as GroupedTickets);
      setGroupedTickets(groups);
    } else {
      setGroupedTickets({});
    }
  }, [sprintTickets]);

  const allAssignedEpicKeys = useMemo(() => {
    const keys = new Set<string>();
    topics.forEach(topic => {
      topic.epics.forEach(epic => keys.add(epic.epicKey));
    });
    return keys;
  }, [topics]);

  const unassignedEpics = useMemo(() => {
    return Object.values(groupedTickets).filter(
      epicGroup => epicGroup.epicKey !== 'NO_EPIC' && !allAssignedEpicKeys.has(epicGroup.epicKey)
    );
  }, [groupedTickets, allAssignedEpicKeys]);

  const ticketsWithoutEpicUnassigned = useMemo(() => {
    const noEpicGroup = groupedTickets['NO_EPIC'];
    if (noEpicGroup && !allAssignedEpicKeys.has('NO_EPIC')) {
        return noEpicGroup;
    }
    return null;
  }, [groupedTickets, allAssignedEpicKeys]);

  const handleToggleEpicSelectionForNewTopicCreation = (epicKey: string) => {
    setSelectedEpicKeysForNewTopicCreation(prev => {
      const newSet = new Set(prev);
      if (newSet.has(epicKey)) {
        newSet.delete(epicKey);
      } else {
        newSet.add(epicKey);
      }
      return newSet;
    });
  };

  const handleOpenCreateTopicModal = () => {
    if (selectedEpicKeysForNewTopicCreation.size === 0) {
      setError("Please select at least one epic (or 'Tickets without Epic') to create a topic.");
      return;
    }
    setNewTopicTitleForSelectedEpics('');
    setNewTopicOwnerForSelectedEpics('');
    setIsCreateTopicModalOpen(true);
    setError(null);
  };

  const handleCloseCreateTopicModal = () => {
    setIsCreateTopicModalOpen(false);
  };

  const handleConfirmCreateTopicForSelectedEpics = () => {
    if (!newTopicTitleForSelectedEpics.trim() || !newTopicOwnerForSelectedEpics.trim()) {
      alert("Topic title and owner cannot be empty."); // Simple alert for modal
      return;
    }

    const epicsToAssign: EpicWithTickets[] = [];
    selectedEpicKeysForNewTopicCreation.forEach(key => {
      if (groupedTickets[key]) {
        epicsToAssign.push(groupedTickets[key]);
      }
    });

    if (epicsToAssign.length === 0) { // Should not happen if button is enabled correctly
        setError("No valid epics were selected to assign.");
        handleCloseCreateTopicModal();
        return;
    }

    const newTopic: Topic = {
      id: Date.now().toString(),
      title: newTopicTitleForSelectedEpics,
      owner: newTopicOwnerForSelectedEpics,
      epics: epicsToAssign,
    };

    setTopics(prevTopics => [...prevTopics, newTopic]);
    setSelectedEpicKeysForNewTopicCreation(new Set());
    handleCloseCreateTopicModal();
  };

  const handleRemoveTopic = (topicIdToRemove: string) => {
    setTopics(prevTopics => prevTopics.filter(topic => topic.id !== topicIdToRemove));
    // Epics will automatically become available again due to useMemo recalculations
    // No need to manually add them back to unassignedEpics
  };

  const handleGenerateConfluencePage = async () => {
    if (!confluencePageUrl.trim()) {
      setConfluenceErrorMessage("Please enter a valid Confluence page URL.");
      return;
    }
    if (!selectedSprint) {
      setConfluenceErrorMessage("Please select a sprint first.");
      return;
    }
    if (topics.length === 0) {
      setConfluenceErrorMessage("Please create at least one topic with assigned content.");
      return;
    }

    setIsGeneratingConfluencePage(true);
    setConfluenceSuccessMessage(null);
    setConfluenceErrorMessage(null);
    setGeneratedConfluenceViewUrl(null);

    try {
      // Map frontend Topic to RetroTopic for the service
      const topicsPayload: RetroTopic[] = topics.map(topic => ({
        id: topic.id,
        title: topic.title,
        owner: topic.owner,
        epics: topic.epics.map(epic => ({
          epicKey: epic.epicKey,
          epicSummary: epic.epicSummary,
          tickets: epic.tickets // Assuming JiraTicket structure is compatible
        }))
      }));

      const result = await confluenceService.generateRetroDemoPage(
        confluencePageUrl,
        topicsPayload,
        selectedSprint.name
      );
      setConfluenceSuccessMessage(result.message || "Confluence page generated successfully!");
      setGeneratedConfluenceViewUrl(result.confluenceViewUrl);
    } catch (err: any) {
      console.error("Error generating Confluence page from frontend:", err);
      setConfluenceErrorMessage(err.message || "Failed to generate Confluence page. Check console for details.");
    } finally {
      setIsGeneratingConfluencePage(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Retro Presentation Generator
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Sprint Selection Column */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>1. Find Sprint</Typography>
            <TextField
              fullWidth
              label="Search Sprints by Name"
              variant="outlined"
              value={sprintSearchQuery}
              onChange={(e) => setSprintSearchQuery(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Button onClick={handleSearchSprints} variant="contained" disabled={loadingSprints || sprintSearchQuery.trim().length === 0}>
              {loadingSprints ? <CircularProgress size={24} /> : 'Search'}
            </Button>
            
            {searchedSprints.length > 0 && (
              <List dense sx={{ maxHeight: 300, overflow: 'auto', mt: 2 }}>
                {searchedSprints.map((sprint) => (
                  <ListItem key={sprint.id} disablePadding>
                    <ListItemButton onClick={() => handleSelectSprint(sprint)}>
                      <ListItemText primary={sprint.name} secondary={`ID: ${sprint.id} - State: ${sprint.state}`} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Available Epics & Tickets Column */}
        <Grid item xs={12} md={8}>
          {selectedSprint && (
            <Paper elevation={2} sx={{ p: 2, mb: 3, height: '100%', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1}}>
                <Typography variant="h6">
                  Available Content for: {selectedSprint.name}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<LibraryAddIcon />}
                  onClick={handleOpenCreateTopicModal}
                  disabled={selectedEpicKeysForNewTopicCreation.size === 0 || loadingTickets}
                >
                  Create Topic from Selected ({selectedEpicKeysForNewTopicCreation.size})
                </Button>
              </Box>

              {loadingTickets ? (
                <CircularProgress />
              ) : sprintTickets.length === 0 && !loadingTickets ? (
                <Typography>No tickets found for this sprint.</Typography>
              ) : (
                <Box>
                  {unassignedEpics.length === 0 && !ticketsWithoutEpicUnassigned && (
                    <Typography sx={{mt:2, fontStyle: 'italic'}}>All content from this sprint has been assigned to topics.</Typography>
                  )}
                  {unassignedEpics.map(group => (
                    <Box key={group.epicKey} sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedEpicKeysForNewTopicCreation.has(group.epicKey)}
                            onChange={() => handleToggleEpicSelectionForNewTopicCreation(group.epicKey)}
                          />
                        }
                        label={
                          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold' }}>
                            {`Epic: ${group.epicSummary} (${group.epicKey})`}
                          </Typography>
                        }
                        sx={{width: '100%'}}
                      />
                      <List dense sx={{pl: 4, pt:0}}>
                        {group.tickets
                          .filter(ticket => ticket.status.toLowerCase() === 'done')
                          .map(ticket => (
                          <ListItem key={ticket.key} sx={{pl: 2, py:0.5}}>
                            <ListItemText
                              primary={`${ticket.key}: ${ticket.summary}`}
                              secondary={`Status: ${ticket.status} | Type: ${ticket.type}${ticket.assignee ? ` | Assignee: ${ticket.assignee}` : ''}`}
                            />
                          </ListItem>
                        ))}
                        {group.tickets.filter(ticket => ticket.status.toLowerCase() === 'done').length === 0 && (
                          <ListItem sx={{pl: 2, py:0.5, fontStyle: 'italic'}}>
                            <ListItemText secondary="No 'Done' tickets in this epic." />
                          </ListItem>
                        )}
                      </List>
                    </Box>
                  ))}
                  {ticketsWithoutEpicUnassigned && (
                    <Box key="NO_EPIC" sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                       <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedEpicKeysForNewTopicCreation.has('NO_EPIC')}
                            onChange={() => handleToggleEpicSelectionForNewTopicCreation('NO_EPIC')}
                          />
                        }
                        label={
                          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold' }}>
                            {ticketsWithoutEpicUnassigned.epicSummary}
                          </Typography>
                        }
                        sx={{width: '100%'}}
                      />
                      <List dense sx={{pl: 4, pt:0}}>
                        {ticketsWithoutEpicUnassigned.tickets // This was already filtered in the previous attempt, ensuring it's correct now
                          .filter(ticket => ticket.status.toLowerCase() === 'done')
                          .map(ticket => (
                          <ListItem key={ticket.key} sx={{pl: 2, py:0.5}}>
                            <ListItemText
                              primary={`${ticket.key}: ${ticket.summary}`}
                              secondary={`Status: ${ticket.status} | Type: ${ticket.type}${ticket.assignee ? ` | Assignee: ${ticket.assignee}` : ''}`}
                            />
                          </ListItem>
                        ))}
                        {ticketsWithoutEpicUnassigned.tickets.filter(ticket => ticket.status.toLowerCase() === 'done').length === 0 && (
                          <ListItem sx={{pl: 2, py:0.5, fontStyle: 'italic'}}>
                            <ListItemText secondary="No 'Done' tickets in this group." />
                          </ListItem>
                        )}
                      </List>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          )}
          {!selectedSprint && !loadingTickets && (
             <Paper elevation={2} sx={{ p: 2, mb: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Typography variant="body1" color="textSecondary">Select a sprint to view its content.</Typography>
             </Paper>
          )}
        </Grid>
      </Grid>
      
      {/* Presentation Topics Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Presentation Topics
      </Typography>

      {topics.length === 0 && (
        <Typography sx={{mt: 2, fontStyle: 'italic'}}>
          No topics created yet. Select content from the list above and click "Create Topic from Selected" to begin.
        </Typography>
      )}

      {/* Confluence Page Generation Section - Placed here */}
      {topics.length > 0 && selectedSprint && (
        <Paper elevation={2} sx={{ p: 2, mt: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>2. Generate Confluence Page</Typography>
          <TextField
            fullWidth
            label="Target Confluence Page URL"
            variant="outlined"
            value={confluencePageUrl}
            onChange={(e) => setConfluencePageUrl(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="e.g., https://your.confluence.site/wiki/spaces/SPACEKEY/pages/12345/Page+Title"
          />
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateConfluencePage}
            disabled={isGeneratingConfluencePage || !confluencePageUrl.trim() || topics.length === 0 || !selectedSprint}
            startIcon={isGeneratingConfluencePage ? <CircularProgress size={20} color="inherit" /> : <ArticleIcon />}
          >
            {isGeneratingConfluencePage ? 'Generating...' : 'Generate Confluence Page'}
          </Button>
          {confluenceSuccessMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {confluenceSuccessMessage}
              {generatedConfluenceViewUrl && (
                <>
                  {' '}
                  <MuiLink href={generatedConfluenceViewUrl} target="_blank" rel="noopener noreferrer">
                    View Page
                  </MuiLink>
                </>
              )}
            </Alert>
          )}
          {confluenceErrorMessage && <Alert severity="error" sx={{ mt: 2 }}>{confluenceErrorMessage}</Alert>}
        </Paper>
      )}

      <Grid container spacing={3} sx={{mt: topics.length > 0 && selectedSprint ? 1 : 0}}> {/* Adjusted margin if confluence section is shown */}
        {topics.map(topic => (
          <Grid item xs={12} sm={6} md={4} key={topic.id}>
            <Card elevation={3} sx={{height: '100%'}}>
              <CardHeader
                titleTypographyProps={{variant:'h6'}}
                title={topic.title}
                subheader={`Owner: ${topic.owner}`}
                action={
                  <Tooltip title="Remove Topic">
                    <IconButton onClick={() => handleRemoveTopic(topic.id)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <Divider />
              <CardContent sx={{maxHeight: 300, overflowY: 'auto'}}>
                {topic.epics.length === 0 && ( 
                  <Typography variant="body2" color="textSecondary">
                    No content assigned.
                  </Typography>
                )}
                {topic.epics.map(epic => (
                  <Box key={epic.epicKey} sx={{mb: 2}}>
                    <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>
                      {epic.epicKey === 'NO_EPIC' ? epic.epicSummary : `${epic.epicSummary} (${epic.epicKey})`}
                    </Typography>
                    <List dense disablePadding sx={{pl:1}}>
                      {epic.tickets // This was also already filtered in the previous attempt
                        .filter(ticket => ticket.status.toLowerCase() === 'done')
                        .map(ticket => (
                         <ListItem key={ticket.key} sx={{py:0.25, pl:2}}>
                           <ListItemText
                            primary={`${ticket.key}: ${ticket.summary}`}
                            secondary={`Status: ${ticket.status} | Type: ${ticket.type}${ticket.assignee ? ` | Assignee: ${ticket.assignee}` : ''}`}
                           />
                         </ListItem>
                      ))}
                      {epic.tickets.filter(ticket => ticket.status.toLowerCase() === 'done').length === 0 && (
                          <ListItem sx={{pl: 2, py:0.25, fontStyle: 'italic'}}>
                            <ListItemText secondary="No 'Done' tickets." />
                          </ListItem>
                        )}
                    </List>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Modal for Creating Topic from Selected Epics */}
      <Dialog open={isCreateTopicModalOpen} onClose={handleCloseCreateTopicModal} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Topic for Selected Content ({selectedEpicKeysForNewTopicCreation.size})</DialogTitle>
        <DialogContent dividers>
          <Typography gutterBottom variant="subtitle2">
            Selected Content:
          </Typography>
          <List dense sx={{mb:2}}>
            {Array.from(selectedEpicKeysForNewTopicCreation).map(key => (
              <ListItem key={key} sx={{py:0.25}}>
                <ListItemText primary={groupedTickets[key]?.epicSummary || key} />
              </ListItem>
            ))}
          </List>
          <TextField
            autoFocus
            margin="dense"
            id="new-topic-title"
            label="Topic Title"
            type="text"
            fullWidth
            variant="outlined"
            value={newTopicTitleForSelectedEpics}
            onChange={(e) => setNewTopicTitleForSelectedEpics(e.target.value)}
            sx={{mb: 2}}
          />
          <TextField
            margin="dense"
            id="new-topic-owner"
            label="Topic Owner (Presenter)"
            type="text"
            fullWidth
            variant="outlined"
            value={newTopicOwnerForSelectedEpics}
            onChange={(e) => setNewTopicOwnerForSelectedEpics(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateTopicModal}>Cancel</Button>
          <Button 
            onClick={handleConfirmCreateTopicForSelectedEpics} 
            variant="contained"
            disabled={!newTopicTitleForSelectedEpics.trim() || !newTopicOwnerForSelectedEpics.trim()}
          >
            Create Topic & Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RetroPresentation;