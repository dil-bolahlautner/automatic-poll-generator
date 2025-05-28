import React, { createContext, useContext, useState, useEffect } from 'react';
import { JiraTicket } from '../services/jiraService';

interface QueueContextType {
  queue: JiraTicket[];
  addToQueue: (tickets: JiraTicket[]) => void;
  removeFromQueue: (ticketKey: string) => void;
  clearQueue: () => void;
}

const STORAGE_KEY = 'pbr_queue';

const QueueContext = createContext<QueueContextType>({
  queue: [],
  addToQueue: () => {},
  removeFromQueue: () => {},
  clearQueue: () => {},
});

export const useQueue = () => useContext(QueueContext);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<JiraTicket[]>(() => {
    // Load initial state from localStorage
    const savedQueue = localStorage.getItem(STORAGE_KEY);
    return savedQueue ? JSON.parse(savedQueue) : [];
  });

  // Save to localStorage whenever queue changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  const addToQueue = (tickets: JiraTicket[]) => {
    setQueue(prev => {
      // Filter out tickets that are already in the queue
      const newTickets = tickets.filter(
        newTicket => !prev.some(existingTicket => existingTicket.key === newTicket.key)
      );
      return [...prev, ...newTickets];
    });
  };

  const removeFromQueue = (ticketKey: string) => {
    setQueue(prev => prev.filter(ticket => ticket.key !== ticketKey));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  return (
    <QueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
      {children}
    </QueueContext.Provider>
  );
}; 