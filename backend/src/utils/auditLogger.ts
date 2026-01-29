import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from './jwtUtils';

export enum AuditEventType {
  // Authentication Events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
  
  // JIRA Operations
  JIRA_TICKET_VIEWED = 'JIRA_TICKET_VIEWED',
  JIRA_TICKET_CREATED = 'JIRA_TICKET_CREATED',
  JIRA_TICKET_UPDATED = 'JIRA_TICKET_UPDATED',
  JIRA_TICKET_DELETED = 'JIRA_TICKET_DELETED',
  JIRA_SPRINT_ACCESSED = 'JIRA_SPRINT_ACCESSED',
  JIRA_BOARD_ACCESSED = 'JIRA_BOARD_ACCESSED',
  
  // Confluence Operations
  CONFLUENCE_PAGE_VIEWED = 'CONFLUENCE_PAGE_VIEWED',
  CONFLUENCE_PAGE_CREATED = 'CONFLUENCE_PAGE_CREATED',
  CONFLUENCE_PAGE_UPDATED = 'CONFLUENCE_PAGE_UPDATED',
  CONFLUENCE_TABLE_GENERATED = 'CONFLUENCE_TABLE_GENERATED',
  CONFLUENCE_SPACE_ACCESSED = 'CONFLUENCE_SPACE_ACCESSED',
  
  // Planning Poker Events
  POKER_SESSION_CREATED = 'POKER_SESSION_CREATED',
  POKER_SESSION_JOINED = 'POKER_SESSION_JOINED',
  POKER_SESSION_LEFT = 'POKER_SESSION_LEFT',
  POKER_VOTE_CAST = 'POKER_VOTE_CAST',
  POKER_VOTES_REVEALED = 'POKER_VOTES_REVEALED',
  POKER_ESTIMATION_FINALIZED = 'POKER_ESTIMATION_FINALIZED',
  POKER_SESSION_TERMINATED = 'POKER_SESSION_TERMINATED',
  
  // Teams Operations
  TEAMS_POLL_CREATED = 'TEAMS_POLL_CREATED',
  TEAMS_POLL_SENT = 'TEAMS_POLL_SENT',
  
  // Administrative Actions
  USER_ADMIN_STATUS_CHANGED = 'USER_ADMIN_STATUS_CHANGED',
  USER_DELETED = 'USER_DELETED',
  SYSTEM_CONFIGURATION_CHANGED = 'SYSTEM_CONFIGURATION_CHANGED',
  SECURITY_SETTINGS_MODIFIED = 'SECURITY_SETTINGS_MODIFIED',
  
  // Data Access Events
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  API_KEY_GENERATED = 'API_KEY_GENERATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  
  // System Events
  BACKUP_CREATED = 'BACKUP_CREATED',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  PERFORMANCE_ISSUE = 'PERFORMANCE_ISSUE',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userAgent?: string;
  ipAddress: string;
  resource?: string;
  action: string;
  details: Record<string, any>;
  severity: AuditSeverity;
  success: boolean;
  errorMessage?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface AuditFilter {
  type?: AuditEventType;
  severity?: AuditSeverity;
  userId?: string;
  startTime?: string;
  endTime?: string;
  success?: boolean;
  resource?: string;
  limit?: number;
  offset?: number;
}

// In-memory audit store (in production, use a proper database)
const auditEvents: AuditEvent[] = [];
const MAX_AUDIT_EVENTS = 50000; // Keep last 50,000 events

/**
 * Generate a unique audit event ID
 */
const generateAuditId = (): string => {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Log an audit event
 */
export const logAuditEvent = (
  type: AuditEventType,
  req: Request,
  action: string,
  details: Record<string, any>,
  severity: AuditSeverity = AuditSeverity.LOW,
  success: boolean = true,
  errorMessage?: string,
  resource?: string
): AuditEvent => {
  const user = (req as any).user as JWTPayload | undefined;
  
  const auditEvent: AuditEvent = {
    id: generateAuditId(),
    type,
    timestamp: new Date().toISOString(),
    userId: user?.sub,
    userEmail: user?.email,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    resource,
    action,
    details,
    severity,
    success,
    errorMessage,
    sessionId: req.headers['x-session-id'] as string,
    requestId: req.headers['x-request-id'] as string,
    metadata: {
      method: req.method,
      url: req.originalUrl,
      headers: {
        'content-type': req.get('Content-Type'),
        'accept': req.get('Accept'),
        'referer': req.get('Referer'),
      }
    }
  };

  // Add to memory store
  auditEvents.push(auditEvent);

  // Keep only the last MAX_AUDIT_EVENTS
  if (auditEvents.length > MAX_AUDIT_EVENTS) {
    auditEvents.splice(0, auditEvents.length - MAX_AUDIT_EVENTS);
  }

  // Log to console with appropriate level
  const logMessage = `[AUDIT] ${auditEvent.type} - ${auditEvent.severity} - User: ${user?.email || 'anonymous'} - Action: ${action} - Success: ${success}`;
  
  switch (severity) {
    case AuditSeverity.CRITICAL:
      console.error(logMessage, details);
      break;
    case AuditSeverity.HIGH:
      console.warn(logMessage, details);
      break;
    case AuditSeverity.MEDIUM:
      console.warn(logMessage, details);
      break;
    case AuditSeverity.LOW:
      console.log(logMessage, details);
      break;
  }

  return auditEvent;
};

/**
 * Get audit events with filtering
 */
export const getAuditEvents = (filter: AuditFilter = {}): AuditEvent[] => {
  let filteredEvents = [...auditEvents];

  if (filter.type) {
    filteredEvents = filteredEvents.filter(event => event.type === filter.type);
  }

  if (filter.severity) {
    filteredEvents = filteredEvents.filter(event => event.severity === filter.severity);
  }

  if (filter.userId) {
    filteredEvents = filteredEvents.filter(event => event.userId === filter.userId);
  }

  if (filter.startTime) {
    filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.startTime!);
  }

  if (filter.endTime) {
    filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.endTime!);
  }

  if (filter.success !== undefined) {
    filteredEvents = filteredEvents.filter(event => event.success === filter.success);
  }

  if (filter.resource) {
    filteredEvents = filteredEvents.filter(event => event.resource === filter.resource);
  }

  // Apply pagination
  if (filter.offset) {
    filteredEvents = filteredEvents.slice(filter.offset);
  }

  if (filter.limit) {
    filteredEvents = filteredEvents.slice(0, filter.limit);
  }

  return filteredEvents;
};

/**
 * Get audit statistics
 */
export const getAuditStats = () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentEvents = auditEvents.filter(event => event.timestamp >= oneHourAgo);
  const dailyEvents = auditEvents.filter(event => event.timestamp >= oneDayAgo);
  const weeklyEvents = auditEvents.filter(event => event.timestamp >= oneWeekAgo);

  const stats = {
    total: auditEvents.length,
    lastHour: recentEvents.length,
    last24Hours: dailyEvents.length,
    lastWeek: weeklyEvents.length,
    byType: {} as Record<AuditEventType, number>,
    bySeverity: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    },
    bySuccess: {
      success: 0,
      failure: 0,
    },
    topUsers: {} as Record<string, number>,
    topResources: {} as Record<string, number>,
  };

  // Count by type, severity, and success
  auditEvents.forEach(event => {
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    stats.bySeverity[event.severity]++;
    stats.bySuccess[event.success ? 'success' : 'failure']++;
    
    if (event.userEmail) {
      stats.topUsers[event.userEmail] = (stats.topUsers[event.userEmail] || 0) + 1;
    }
    
    if (event.resource) {
      stats.topResources[event.resource] = (stats.topResources[event.resource] || 0) + 1;
    }
  });

  return stats;
};

/**
 * Search audit events by text
 */
export const searchAuditEvents = (query: string): AuditEvent[] => {
  const searchTerm = query.toLowerCase();
  
  return auditEvents.filter(event => 
    event.action.toLowerCase().includes(searchTerm) ||
    event.userEmail?.toLowerCase().includes(searchTerm) ||
    event.resource?.toLowerCase().includes(searchTerm) ||
    event.errorMessage?.toLowerCase().includes(searchTerm) ||
    JSON.stringify(event.details).toLowerCase().includes(searchTerm)
  );
};

/**
 * Export audit events for compliance
 */
export const exportAuditEvents = (filter: AuditFilter = {}): string => {
  const events = getAuditEvents(filter);
  
  const csvHeaders = [
    'ID', 'Type', 'Timestamp', 'User ID', 'User Email', 'IP Address',
    'Resource', 'Action', 'Severity', 'Success', 'Error Message'
  ];
  
  const csvRows = events.map(event => [
    event.id,
    event.type,
    event.timestamp,
    event.userId || '',
    event.userEmail || '',
    event.ipAddress,
    event.resource || '',
    event.action,
    event.severity,
    event.success ? 'true' : 'false',
    event.errorMessage || ''
  ]);
  
  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  return csvContent;
};

/**
 * Clean up old audit events (older than 90 days)
 */
export const cleanupOldAuditEvents = (): number => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const initialLength = auditEvents.length;
  
  const filteredEvents = auditEvents.filter(event => event.timestamp >= ninetyDaysAgo);
  auditEvents.length = 0;
  auditEvents.push(...filteredEvents);
  
  return initialLength - auditEvents.length;
};

/**
 * Audit middleware for automatic logging
 */
export const auditMiddleware = (eventType: AuditEventType, action: string, severity: AuditSeverity = AuditSeverity.LOW) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      const success = (res as any).statusCode < 400;
      const errorMessage = success ? undefined : data;
      
      logAuditEvent(
        eventType,
        req,
        action,
        { statusCode: (res as any).statusCode, responseSize: data?.length || 0 },
        severity,
        success,
        errorMessage
      );
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Clean up old events weekly
setInterval(cleanupOldAuditEvents, 7 * 24 * 60 * 60 * 1000); 