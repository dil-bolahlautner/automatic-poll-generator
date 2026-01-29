import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as authService from '../services/authService';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Button, CircularProgress, Alert, Switch } from '@mui/material';

interface User {
  id: number;
  email: string;
  is_admin: boolean;
}

const AdminUsers: React.FC = () => {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.getUsers(token);
      setUsers(data);
    } catch (err: any) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, [token]);

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await authService.deleteUser(id, token);
      setUsers(users.filter(u => u.id !== id));
    } catch {
      setError('Failed to delete user');
    }
  };

  const handleAdminToggle = async (id: number, isAdmin: boolean) => {
    if (!token) return;
    try {
      await authService.setAdmin(id, isAdmin, token);
      setUsers(users.map(u => u.id === id ? { ...u, is_admin: isAdmin } : u));
    } catch {
      setError('Failed to update admin status');
    }
  };

  if (!user?.is_admin) {
    return <Alert severity="error">Admin access required</Alert>;
  }

  return (
    <Box maxWidth={700} mx="auto" mt={8} p={3} boxShadow={3} borderRadius={2} bgcolor="white">
      <Typography variant="h5" mb={2}>User Management</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress /> : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Admin</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_admin}
                    onChange={e => handleAdminToggle(u.id, e.target.checked)}
                    disabled={u.id === user.id}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleDelete(u.id)}
                    disabled={u.id === user.id}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default AdminUsers; 