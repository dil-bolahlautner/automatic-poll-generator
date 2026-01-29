import React, { useState } from 'react';
import { Button, Typography, Box, Alert } from '@mui/material';
import { jiraService } from '../services/jiraService';
import { getAuthToken, isAuthenticated } from '../utils/authUtils';

export const AuthTest: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testAuth = async () => {
    setIsLoading(true);
    setTestResult('');

    try {
      // Check if user is authenticated
      const authenticated = isAuthenticated();
      const token = getAuthToken();
      
      console.log('Auth status:', { authenticated, hasToken: !!token });
      
      if (!authenticated) {
        setTestResult('❌ Not authenticated - no valid token found');
        return;
      }

      // Test API call to Node.js backend
      const response = await jiraService.getTickets();
      
      setTestResult(`✅ Authentication successful! Retrieved ${response.tickets.length} tickets from JIRA API`);
      
    } catch (error: any) {
      console.error('Auth test failed:', error);
      
      if (error.response?.status === 401) {
        setTestResult('❌ Authentication failed - 401 Unauthorized. Token may be invalid or expired.');
      } else if (error.response?.status === 403) {
        setTestResult('❌ Authentication failed - 403 Forbidden. User may not have required permissions.');
      } else {
        setTestResult(`❌ Authentication test failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Authentication Test
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={testAuth}
        disabled={isLoading}
        sx={{ mb: 2 }}
      >
        {isLoading ? 'Testing...' : 'Test Authentication'}
      </Button>

      {testResult && (
        <Alert severity={testResult.includes('✅') ? 'success' : 'error'} sx={{ mt: 2 }}>
          {testResult}
        </Alert>
      )}
    </Box>
  );
}; 