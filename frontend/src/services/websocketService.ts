/*import type { Socket } from 'socket.io-client/dist/socket';*/

type MessageHandler = (message: { type: string; payload: any }) => void;

class WebSocketService {
  private socket: any = null;
  private messageHandlers: Set<MessageHandler> = new Set();

  async connect(userId: string, isHost: boolean) {
    if (this.socket) {
      this.socket.disconnect();
    }

    console.log('Connecting to WebSocket...');
    const { default: io } = await import('socket.io-client');
    this.socket = io(process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001', {
      auth: {
        userId,
        isHost,
      },
      path: '/ws/estimation'
    });

    console.log('Socket instance created');

    this.socket.on('message', (message: { type: string; payload: any }) => {
      console.log('Received message:', message);
      this.messageHandlers.forEach((handler) => handler(message));
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        console.error('Socket not initialized');
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });
    });
  }

  subscribe(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  async registerUser(userId: string, name: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    console.log('Registering user:', { userId, name });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('Registration timed out');
        reject(new Error('Registration timed out'));
      }, 5000);

      const handleRegistrationError = (message: any) => {
        console.log('Received registration error:', message);
        if (message.type === 'REGISTRATION_ERROR') {
          clearTimeout(timeout);
          this.socket!.off('REGISTRATION_ERROR', handleRegistrationError);
          reject(new Error(message.payload.error));
        }
      };

      this.socket!.on('REGISTRATION_ERROR', handleRegistrationError);
      this.socket!.emit('register', { userId, name, isHost: this.socket!.auth.isHost }, (response: { error?: string }) => {
        console.log('Registration response:', response);
        if (response.error) {
          clearTimeout(timeout);
          this.socket!.off('REGISTRATION_ERROR', handleRegistrationError);
          reject(new Error(response.error));
        } else {
          clearTimeout(timeout);
          this.socket!.off('REGISTRATION_ERROR', handleRegistrationError);
          resolve();
        }
      });
    });
  }

  async createEvent(name: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    console.log('Attempting to create event:', name);
    console.log('Current socket auth:', this.socket.auth);

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('Event creation timed out');
        reject(new Error('Event creation timed out'));
      }, 5000);

      const handleEventCreated = (message: any) => {
        console.log('Received EVENT_CREATED:', message);
        if (message.type === 'EVENT_CREATED') {
          clearTimeout(timeout);
          this.socket!.off('EVENT_CREATED', handleEventCreated);
          this.socket!.off('ERROR', handleError);
          resolve();
        }
      };

      const handleError = (message: any) => {
        console.error('Received error during event creation:', message);
        if (message.type === 'ERROR') {
          clearTimeout(timeout);
          this.socket!.off('EVENT_CREATED', handleEventCreated);
          this.socket!.off('ERROR', handleError);
          reject(new Error(message.payload.message || 'Failed to create event'));
        }
      };

      console.log('Setting up event listeners');
      this.socket!.on('EVENT_CREATED', handleEventCreated);
      this.socket!.on('ERROR', handleError);
      
      console.log('Emitting create_event');
      this.socket!.emit('create_event', { 
        name, 
        hostId: this.socket!.auth.userId
      });
    });
  }

  async joinEvent(eventId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('join_event', { eventId }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  async leaveEvent(eventId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('leave_event', { eventId }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  async startVoting(ticketKey: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('start_voting', { ticketKey }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  async closeVoting(ticketKey: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('close_voting', { ticketKey }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  async restartVoting(ticketKey: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('restart_voting', { ticketKey }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  async sendVote(ticketKey: string, vote: number | '?') {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('send_vote', { ticketKey, vote }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const websocketService = new WebSocketService(); 