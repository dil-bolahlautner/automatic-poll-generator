import { JWTPayload } from './jwtUtils';

export interface SessionConfig {
  maxSessionDuration: number; // in milliseconds
  idleTimeout: number; // in milliseconds
  refreshThreshold: number; // in milliseconds - when to refresh token
}

export interface SessionInfo {
  userId: string;
  email: string;
  isAdmin: boolean;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

// Default session configuration
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeout: 60 * 60 * 1000, // 1 hour
  refreshThreshold: 15 * 60 * 1000, // 15 minutes
};

// In-memory session store (in production, use Redis or database)
const sessionStore = new Map<string, SessionInfo>();

/**
 * Create a new session
 */
export const createSession = (
  user: JWTPayload,
  config: Partial<SessionConfig> = {}
): SessionInfo => {
  const sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config };
  const now = Date.now();
  
  const sessionInfo: SessionInfo = {
    userId: user.sub,
    email: user.email,
    isAdmin: user.is_admin,
    createdAt: now,
    lastActivity: now,
    expiresAt: now + sessionConfig.maxSessionDuration,
  };

  sessionStore.set(user.sub, sessionInfo);
  return sessionInfo;
};

/**
 * Validate and update session
 */
export const validateSession = (
  userId: string,
  config: Partial<SessionConfig> = {}
): { valid: boolean; session?: SessionInfo; needsRefresh?: boolean } => {
  const sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config };
  const session = sessionStore.get(userId);
  
  if (!session) {
    return { valid: false };
  }

  const now = Date.now();

  // Check if session has expired
  if (now > session.expiresAt) {
    sessionStore.delete(userId);
    return { valid: false };
  }

  // Check if session is idle
  if (now - session.lastActivity > sessionConfig.idleTimeout) {
    sessionStore.delete(userId);
    return { valid: false };
  }

  // Update last activity
  session.lastActivity = now;
  sessionStore.set(userId, session);

  // Check if token needs refresh
  const needsRefresh = session.expiresAt - now < sessionConfig.refreshThreshold;

  return { valid: true, session, needsRefresh };
};

/**
 * Refresh session
 */
export const refreshSession = (
  userId: string,
  config: Partial<SessionConfig> = {}
): SessionInfo | null => {
  const sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config };
  const session = sessionStore.get(userId);
  
  if (!session) {
    return null;
  }

  const now = Date.now();
  
  // Extend session
  session.expiresAt = now + sessionConfig.maxSessionDuration;
  session.lastActivity = now;
  
  sessionStore.set(userId, session);
  return session;
};

/**
 * Invalidate session
 */
export const invalidateSession = (userId: string): boolean => {
  return sessionStore.delete(userId);
};

/**
 * Get session info
 */
export const getSession = (userId: string): SessionInfo | undefined => {
  return sessionStore.get(userId);
};

/**
 * Clean up expired sessions
 */
export const cleanupExpiredSessions = (): number => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [userId, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(userId);
      cleanedCount++;
    }
  }

  return cleanedCount;
};

/**
 * Get session statistics
 */
export const getSessionStats = () => {
  const now = Date.now();
  const totalSessions = sessionStore.size;
  let activeSessions = 0;
  let expiredSessions = 0;

  for (const session of sessionStore.values()) {
    if (now > session.expiresAt) {
      expiredSessions++;
    } else {
      activeSessions++;
    }
  }

  return {
    total: totalSessions,
    active: activeSessions,
    expired: expiredSessions,
  };
};

// Clean up expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000); 