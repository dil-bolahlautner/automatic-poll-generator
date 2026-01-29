import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jiraService, JiraTicket, FixVersion } from '../services/jiraService';
import { useAuth } from './AuthContext';

interface JiraContextType {
  tickets: JiraTicket[];
  total: number;
  fixVersions: FixVersion[];
  isLoading: boolean;
  error: string | null;
}

const JiraContext = createContext<JiraContextType>({
  tickets: [],
  total: 0,
  fixVersions: [],
  isLoading: false,
  error: null
});

export const useJira = () => useContext(JiraContext);

export const JiraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const isAuthenticated = !!token;

  const { data, isLoading: isTicketsLoading, error: ticketsError } = useQuery({
    queryKey: ['tickets'],
    queryFn: jiraService.getTickets,
    enabled: isAuthenticated, // Only fetch when user is authenticated
  });

  const { data: fixVersions = [], isLoading: isVersionsLoading, error: versionsError } = useQuery({
    queryKey: ['fixVersions'],
    queryFn: jiraService.getFixVersions,
    enabled: isAuthenticated, // Only fetch when user is authenticated
  });

  const isLoading = isTicketsLoading || isVersionsLoading;
  const error = ticketsError?.message || versionsError?.message || null;

  return (
    <JiraContext.Provider value={{ 
      tickets: data?.tickets || [], 
      total: data?.total || 0,
      fixVersions, 
      isLoading, 
      error 
    }}>
      {children}
    </JiraContext.Provider>
  );
}; 