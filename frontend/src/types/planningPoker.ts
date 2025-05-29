// Corresponds to backend/src/types/planningPoker.ts

export interface PlanningPokerUser {
  id: string; // WebSocket connection ID or a generated UUID
  name: string;
  isHost: boolean;
  hasVoted: boolean;
  vote?: string | null; // Actual vote value, or 'VOTED' placeholder, or null
}

export interface JiraTicket {
  key: string;
  summary: string;
  description?: string;
  url: string;
  type: string;
  status: string;
  labels: string[];
  reporter?: string;
  assignee?: string;
  parent?: {
    key: string;
    summary: string;
    type?: string;
  };
  fixVersions: {
    id: string;
    name: string;
    released: boolean;
  }[];
  linkedIssues: {
    type: string;
    key: string;
    direction: 'inward' | 'outward';
  }[];
  blockingIssues: {
    key: string;
    summary: string;
    status: string;
    type: string;
  }[];
}

export interface PlanningPokerSession {
  id: string; // Unique session identifier
  hostId: string; // User ID of the host
  users: PlanningPokerUser[];
  tickets: JiraTicket[]; // Tickets selected for estimation
  currentTicketKey: string | null; // Key of the ticket currently being estimated
  votingOpen: boolean; // Is voting currently allowed for the current ticket
  votesRevealed: boolean; // Have votes for the current ticket been revealed
  // Frontend might derive additional state, e.g., average vote, from this
}

// Websocket event payloads (examples, might need more based on implementation)
export interface SessionCreatedPayload extends PlanningPokerSession {}
export interface SessionUpdatedPayload extends PlanningPokerSession {}

export interface SessionTerminatedPayload {
  sessionId: string;
  reason: string;
}

export interface ErrorPayload {
  message: string;
  details?: any;
}