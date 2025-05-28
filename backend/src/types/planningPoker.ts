export interface PlanningPokerUser {
  id: string; // Unique identifier for the user in the session (e.g., WebSocket connection ID or a generated UUID)
  name: string;
  isHost: boolean;
  hasVoted: boolean;
  vote?: string | null; // Store the vote value (e.g., '1', '5', '?', or null if not voted/vote cleared)
}

export interface JiraTicket {
  key: string;
  summary: string;
  description?: string; // Optional, as per requirements
  url: string; // Link to the Jira ticket
  type?: string; // Optional, from existing PlanningPoker.tsx
  status?: string; // Optional, from existing PlanningPoker.tsx
}

export interface PlanningPokerSession {
  id: string; // Unique session identifier
  hostId: string; // User ID of the host
  users: PlanningPokerUser[];
  tickets: JiraTicket[]; // Tickets selected for estimation
  currentTicketKey: string | null; // Key of the ticket currently being estimated
  votingOpen: boolean; // Is voting currently allowed for the current ticket
  votesRevealed: boolean; // Have votes for the current ticket been revealed
  // We might add a structure to store votes per ticket later
  // e.g., currentVotes: Record<string, string | null>; // { [userId]: voteValue }
}