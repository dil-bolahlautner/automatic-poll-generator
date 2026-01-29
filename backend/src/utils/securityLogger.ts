import { Request } from 'express';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
}

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  userId?: string;
  email?: string;
  ip: string;
  userAgent?: string;
  url: string;
  method: string;
  details?: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// In-memory security event store (in production, use a proper logging service)
const securityEvents: SecurityEvent[] = [];
const MAX_EVENTS = 10000; // Keep last 10,000 events

/**
 * Log a security event
 */
export const logSecurityEvent = (
  type: SecurityEventType,
  req: Request,
  details?: any,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW',
  userId?: string,
  email?: string
) => {
  const event: SecurityEvent = {
    type,
    timestamp: new Date().toISOString(),
    userId,
    email,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    method: req.method,
    details,
    severity,
  };

  // Add to memory store
  securityEvents.push(event);

  // Keep only the last MAX_EVENTS
  if (securityEvents.length > MAX_EVENTS) {
    securityEvents.splice(0, securityEvents.length - MAX_EVENTS);
  }

  // Log to console with appropriate level
  const logMessage = `[SECURITY] ${event.type} - ${event.severity} - IP: ${event.ip} - User: ${email || userId || 'anonymous'} - ${event.url}`;
  
  switch (severity) {
    case 'CRITICAL':
      console.error(logMessage, details);
      break;
    case 'HIGH':
      console.warn(logMessage, details);
      break;
    case 'MEDIUM':
      console.warn(logMessage, details);
      break;
    case 'LOW':
      console.log(logMessage, details);
      break;
  }

  return event;
};

/**
 * Get security events with filtering
 */
export const getSecurityEvents = (
  filters: {
    type?: SecurityEventType;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}
): SecurityEvent[] => {
  let filteredEvents = [...securityEvents];

  if (filters.type) {
    filteredEvents = filteredEvents.filter(event => event.type === filters.type);
  }

  if (filters.severity) {
    filteredEvents = filteredEvents.filter(event => event.severity === filters.severity);
  }

  if (filters.userId) {
    filteredEvents = filteredEvents.filter(event => event.userId === filters.userId);
  }

  if (filters.startTime) {
    filteredEvents = filteredEvents.filter(event => event.timestamp >= filters.startTime!);
  }

  if (filters.endTime) {
    filteredEvents = filteredEvents.filter(event => event.timestamp <= filters.endTime!);
  }

  if (filters.limit) {
    filteredEvents = filteredEvents.slice(-filters.limit);
  }

  return filteredEvents;
};

/**
 * Get security statistics
 */
export const getSecurityStats = () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const recentEvents = securityEvents.filter(event => event.timestamp >= oneHourAgo);
  const dailyEvents = securityEvents.filter(event => event.timestamp >= oneDayAgo);

  const stats = {
    total: securityEvents.length,
    lastHour: recentEvents.length,
    last24Hours: dailyEvents.length,
    byType: {} as Record<SecurityEventType, number>,
    bySeverity: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    },
    topIPs: {} as Record<string, number>,
  };

  // Count by type and severity
  securityEvents.forEach(event => {
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    stats.bySeverity[event.severity]++;
    stats.topIPs[event.ip] = (stats.topIPs[event.ip] || 0) + 1;
  });

  return stats;
};

/**
 * Check for suspicious activity patterns
 */
export const detectSuspiciousActivity = (req: Request): boolean => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  // Check for rapid failed login attempts
  const recentFailedLogins = securityEvents.filter(event => 
    event.type === SecurityEventType.LOGIN_FAILED &&
    event.ip === ip &&
    event.timestamp >= fiveMinutesAgo
  );

  if (recentFailedLogins.length >= 5) {
    logSecurityEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      req,
      { reason: 'Multiple failed login attempts', count: recentFailedLogins.length },
      'HIGH'
    );
    return true;
  }

  // Check for unusual user agent patterns
  const userAgent = req.get('User-Agent');
  if (userAgent && (
    userAgent.includes('bot') ||
    userAgent.includes('crawler') ||
    userAgent.includes('scanner') ||
    userAgent.length < 10
  )) {
    logSecurityEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      req,
      { reason: 'Suspicious user agent', userAgent },
      'MEDIUM'
    );
    return true;
  }

  return false;
};

/**
 * Clean up old security events (older than 30 days)
 */
export const cleanupOldSecurityEvents = (): number => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const initialLength = securityEvents.length;
  
  const filteredEvents = securityEvents.filter(event => event.timestamp >= thirtyDaysAgo);
  securityEvents.length = 0;
  securityEvents.push(...filteredEvents);
  
  return initialLength - securityEvents.length;
};

// Clean up old events daily
setInterval(cleanupOldSecurityEvents, 24 * 60 * 60 * 1000); 