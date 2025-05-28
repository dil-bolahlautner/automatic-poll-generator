import React, { createContext, useContext, useState } from 'react';
import { JiraTicket } from '../services/jiraService';

interface SelectedTicketsContextType {
  selectedTickets: JiraTicket[];
  setSelectedTickets: (tickets: JiraTicket[]) => void;
}

const SelectedTicketsContext = createContext<SelectedTicketsContextType>({
  selectedTickets: [],
  setSelectedTickets: () => {},
});

export const useSelectedTickets = () => useContext(SelectedTicketsContext);

export const SelectedTicketsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedTickets, setSelectedTickets] = useState<JiraTicket[]>([]);

  return (
    <SelectedTicketsContext.Provider value={{ selectedTickets, setSelectedTickets }}>
      {children}
    </SelectedTicketsContext.Provider>
  );
}; 