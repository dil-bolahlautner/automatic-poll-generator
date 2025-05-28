export const jiraConfig = {
  // Default JQL filter for PBR tickets
  // You can copy this directly from your JIRA filter URL
  defaultFilter: 'project = "QST" AND status IN ("To Do", Backlog) AND type in (Story, Bug) AND Sprint = 6660 ORDER BY created DESC',
  // Optional JQL to further filter issues within a sprint (e.g., 'issuetype != Epic')
  sprintIssuesJql: '',
  
  // Fields to request from JIRA API
  fields: [
    'key',
    'summary',
    'status',
    'issuetype',
    'fixVersions',
    'issuelinks',
    'parent',
    'labels',
    'subtasks',
    'reporter',
    'assignee' // Added assignee field
  ]
};