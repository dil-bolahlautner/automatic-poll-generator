import axios from 'axios';

const API_URL = import.meta.env.PROD
  ? import.meta.env.VITE_AUTH_API_URL 
  : 'http://localhost:3002';

console.log('API URL:', API_URL); // Debug log

export interface UserExistsResponse {
  exists: boolean;
  email: string;
}

export async function checkUserExists(email: string): Promise<UserExistsResponse> {
  try {
    console.log('Checking if user exists:', email);
    const response = await axios.get<UserExistsResponse>(`${API_URL}/check-user/${encodeURIComponent(email)}`);
    console.log('User exists response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timed out. Please check if the server is running.');
      }
      if (error.response) {
        throw new Error(error.response.data.detail || 'Failed to check if user exists');
      }
    }
    throw error;
  }
}

export async function login(email: string, password: string) {
  try {
    console.log('Attempting login to:', `${API_URL}/login`); // Debug log
    const response = await axios.post(`${API_URL}/login`, new URLSearchParams({
      username: email,
      password,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      withCredentials: true, // Enable credentials
    });
    console.log('Login response:', response.data); // Debug log
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timed out. Please check if the server is running.');
      }
      if (error.response) {
        throw new Error(error.response.data.detail || 'Login failed');
      }
    }
    throw error;
  }
}

export async function register(email: string, password: string) {
  try {
    console.log('Attempting registration for email:', email);
    console.log('Password length:', password.length);
    const response = await axios.post(`${API_URL}/register`, { 
      email, 
      password 
    }, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('Registration successful');
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timed out. Please check if the server is running.');
      }
      if (error.response) {
        throw new Error(error.response.data.detail || 'Registration failed');
      }
    }
    throw error;
  }
}

export async function getUsers(token: string) {
  const response = await axios.get(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function deleteUser(userId: number, token: string) {
  const response = await axios.delete(`${API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function setAdmin(userId: number, isAdmin: boolean, token: string) {
  const response = await axios.post(`${API_URL}/users/${userId}/set_admin?is_admin=${isAdmin}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function keepAlive(token: string) {
  try {
    const response = await axios.post(`${API_URL}/keep-alive`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      throw new Error('Session expired');
    }
    throw error;
  }
} 