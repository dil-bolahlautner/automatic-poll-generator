import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { websocketService } from '../services/websocketService';

interface User {
  id: string;
  name: string;
  isHost: boolean;
}

interface Ticket {
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

interface EstimationEvent {
  id: string;
  name: string;
  hostId: string;
  status: 'active' | 'completed';
  createdAt: string;
  currentTicketIndex: number;
  tickets: Ticket[];
  participants: User[];
}

interface EstimationState {
  currentUser: User | null;
  currentEvent: EstimationEvent | null;
}

type EstimationAction =
  | { type: 'SET_CURRENT_USER'; payload: User }
  | { type: 'SET_CURRENT_EVENT'; payload: EstimationEvent }
  | { type: 'RESET_EVENT' }
  | { type: 'NEXT_TICKET' };

const initialState: EstimationState = {
  currentUser: null,
  currentEvent: null,
};

function estimationReducer(state: EstimationState, action: EstimationAction): EstimationState {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return {
        ...state,
        currentUser: action.payload,
      };
    case 'SET_CURRENT_EVENT':
      return {
        ...state,
        currentEvent: action.payload,
      };
    case 'RESET_EVENT':
      return {
        ...state,
        currentEvent: null,
      };
    case 'NEXT_TICKET':
      if (!state.currentEvent) return state;
      return {
        ...state,
        currentEvent: {
          ...state.currentEvent,
          currentTicketIndex: state.currentEvent.currentTicketIndex + 1,
        },
      };
    default:
      return state;
  }
}

const EstimationContext = createContext<{
  state: EstimationState;
  dispatch: React.Dispatch<EstimationAction>;
} | null>(null);

export function EstimationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(estimationReducer, initialState);

  useEffect(() => {
    const handleEventUpdate = (message: any) => {
      if (message.type === 'EVENT_UPDATED') {
        dispatch({
          type: 'SET_CURRENT_EVENT',
          payload: message.payload.event
        });
      }
    };

    const unsubscribe = websocketService.subscribe(handleEventUpdate);
    return () => unsubscribe();
  }, []);

  return (
    <EstimationContext.Provider value={{ state, dispatch }}>
      {children}
    </EstimationContext.Provider>
  );
}

export function useEstimation() {
  const context = useContext(EstimationContext);
  if (!context) {
    throw new Error('useEstimation must be used within an EstimationProvider');
  }
  return context;
} 