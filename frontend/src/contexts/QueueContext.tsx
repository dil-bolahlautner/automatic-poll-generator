import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { JiraTicket } from '../types/planningPoker'; // Use the type from planningPoker for consistency
import planningPokerWsService from '../services/planningPokerWebsocketService';

interface QueueContextType {
  queue: JiraTicket[];
  isConnected: boolean;
  error: string | null;
  setLiveQueue: (newQueue: JiraTicket[]) => void; // For WebSocket service to update the queue
  addTicketsToGlobalQueue: (tickets: JiraTicket[]) => void;
  removeTicketFromGlobalQueue: (ticketKey: string) => void;
  clearGlobalQueue: () => void;
}

const QueueContext = createContext<QueueContextType>({
  queue: [],
  isConnected: false,
  error: null,
  setLiveQueue: () => {},
  addTicketsToGlobalQueue: () => {},
  removeTicketFromGlobalQueue: () => {},
  clearGlobalQueue: () => {},
});

export const useQueue = () => useContext(QueueContext);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<JiraTicket[]>([]); // Initial state is an empty array
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleConnected = () => {
      console.log('[QueueContext] WebSocket connected');
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnected = () => {
      console.log('[QueueContext] WebSocket disconnected');
      setIsConnected(false);
    };

    const handleError = (err: { message: string }) => {
      console.error('[QueueContext] WebSocket error:', err);
      setError(err.message);
    };

    // Set up WebSocket event handlers
    planningPokerWsService.onConnected(handleConnected);
    planningPokerWsService.onDisconnected(handleDisconnected);
    planningPokerWsService.onError(handleError);

    // Clean up event handlers
    return () => {
      planningPokerWsService.offConnected(handleConnected);
      planningPokerWsService.offDisconnected(handleDisconnected);
      planningPokerWsService.offError(handleError);
    };
  }, []);

  // This function will be called by the WebSocket event handler in PlanningPoker.tsx
  // when 'server.pbrQueue.updated' is received.
  const setLiveQueue = useCallback((newQueue: JiraTicket[]) => {
    console.log('[QueueContext] setLiveQueue called. New queue length:', newQueue.length, 'New queue:', newQueue);
    setQueue(newQueue);
  }, []);

  const addTicketsToGlobalQueue = useCallback((tickets: JiraTicket[]) => {
    if (!isConnected) {
      setError('Cannot add tickets: not connected to server');
      return;
    }
    planningPokerWsService.addTicketsToQueue(tickets);
  }, [isConnected]);

  const removeTicketFromGlobalQueue = useCallback((ticketKey: string) => {
    if (!isConnected) {
      setError('Cannot remove ticket: not connected to server');
      return;
    }
    planningPokerWsService.removeTicketFromQueue(ticketKey);
  }, [isConnected]);

  const clearGlobalQueue = useCallback(() => {
    if (!isConnected) {
      setError('Cannot clear queue: not connected to server');
      return;
    }
    planningPokerWsService.clearQueue();
  }, [isConnected]);

  return (
    <QueueContext.Provider
      value={{
        queue,
        isConnected,
        error,
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