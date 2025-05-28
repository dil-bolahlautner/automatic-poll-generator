export interface VotingMessage {
  type: 'vote' | 'start' | 'close' | 'restart';
  ticketKey?: string;
  voterId?: string;
  vote?: number | '?';
} 