export interface User {
  id: string;
  name: string;
  isHost: boolean;
}

export interface Ticket {
  key: string;
  summary: string;
  description?: string;
  votes: Record<string, number | '?'>;
  status: 'pending' | 'voting' | 'closed';
  result?: {
    average: number;
    median: number;
    mode: number;
  };
}

export interface EstimationEvent {
  id: string;
  name: string;
  hostId: string;
  status: 'active' | 'completed';
  createdAt: string;
  currentTicketIndex: number;
  tickets: Ticket[];
  participants: User[];
}

export interface EstimationState {
  currentEvent: EstimationEvent | null;
  currentUser: User | null;
  isConnected: boolean;
  error: string | null;
} 