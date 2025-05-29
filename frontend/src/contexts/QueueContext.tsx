import React, { createContext, useContext, useState, useCallback } from 'react';
import { JiraTicket } from '../types/planningPoker'; // Use the type from planningPoker for consistency
import { planningPokerWsService } from '../services/planningPokerWebsocketService';

interface QueueContextType {
  queue: JiraTicket[];
  setLiveQueue: (newQueue: JiraTicket[]) => void; // For WebSocket service to update the queue
  addTicketsToGlobalQueue: (tickets: JiraTicket[]) => void;
  removeTicketFromGlobalQueue: (ticketKey: string) => void;
  clearGlobalQueue: () => void;
}

const QueueContext = createContext<QueueContextType>({
  queue: [],
  setLiveQueue: () => {},
  addTicketsToGlobalQueue: () => {},
  removeTicketFromGlobalQueue: () => {},
  clearGlobalQueue: () => {},
});

export const useQueue = () => useContext(QueueContext);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<JiraTicket[]>([]); // Initial state is an empty array

  // This function will be called by the WebSocket event handler in PlanningPoker.tsx
  // when 'server.pbrQueue.updated' is received.
  const setLiveQueue = useCallback((newQueue: JiraTicket[]) => {
    console.log('[QueueContext] setLiveQueue called. New queue length:', newQueue.length, 'New queue:', newQueue);
    setQueue(newQueue);
  }, []);

  const addTicketsToGlobalQueue = (tickets: JiraTicket[]) => {
    // No direct state update here. Emit event to server.
    // The server will broadcast 'server.pbrQueue.updated', which will call setLiveQueue.
    planningPokerWsService.emitAddTicketsToGlobalQueue(tickets);
  };

  const removeTicketFromGlobalQueue = (ticketKey: string) => {
    planningPokerWsService.emitRemoveTicketFromGlobalQueue(ticketKey);
  };

  const clearGlobalQueue = () => {
    planningPokerWsService.emitClearGlobalPbrQueue();
  };

  return (
    <QueueContext.Provider
      value={{
        queue,
        setLiveQueue,
        addTicketsToGlobalQueue,
        removeTicketFromGlobalQueue,
        clearGlobalQueue
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};