import { Router, Request, Response } from 'express';
import { createSession, invalidateSession, getSessionStats } from '../utils/sessionUtils';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { validatePagination } from '../middleware/validationMiddleware';
import { getSecurityStats, getSecurityEvents, SecurityEventType } from '../utils/securityLogger';
import { getAuditEvents, getAuditStats, searchAuditEvents, exportAuditEvents, AuditEventType, AuditSeverity } from '../utils/auditLogger';

const router = Router();

/**
 * Create a new session (called after successful login)
 */
router.post('/session', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    const session = createSession(authenticatedReq.user);
    res.json({
      success: true,
      session: {
        userId: session.userId,
        email: session.email,
        isAdmin: session.isAdmin,
        expiresAt: session.expiresAt,
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: 'Session creation failed',
      message: 'Failed to create session'
    });
  }
});

/**
 * Invalidate current session (logout)
 */
router.delete('/session', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    const invalidated = invalidateSession(authenticatedReq.user.sub);
    if (invalidated) {
      res.json({
        success: true,
        message: 'Session invalidated successfully'
      });
    } else {
      res.status(404).json({
        error: 'Session not found',
        message: 'No active session found'
      });
    }
  } catch (error) {
    console.error('Session invalidation error:', error);
    res.status(500).json({
      error: 'Session invalidation failed',
      message: 'Failed to invalidate session'
    });
  }
});

/**
 * Get session statistics (admin only)
 */
router.get('/sessions/stats', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const stats = getSessionStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({
      error: 'Failed to get session statistics',
      message: 'Internal server error'
    });
  }
});

/**
 * Get security statistics (admin only)
 */
router.get('/security/stats', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const stats = getSecurityStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Security stats error:', error);
    res.status(500).json({
      error: 'Failed to get security statistics',
      message: 'Internal server error'
    });
  }
});

/**
 * Get security events (admin only)
 */
router.get('/security/events', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const { type, severity, limit } = req.query;
    const events = getSecurityEvents({
      type: type as SecurityEventType,
      severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      limit: limit ? parseInt(limit as string) : 100
    });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Security events error:', error);
    res.status(500).json({
      error: 'Failed to get security events',
      message: 'Internal server error'
    });
  }
});

/**
 * Get audit events (admin only)
 */
router.get('/audit/events', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const { type, severity, userId, startTime, endTime, success, resource, limit, offset } = req.query;
    const events = getAuditEvents({
      type: type as AuditEventType,
      severity: severity as AuditSeverity,
      userId: userId as string,
      startTime: startTime as string,
      endTime: endTime as string,
      success: success === 'true',
      resource: resource as string,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      success: true,
      events,
      total: events.length
    });
  } catch (error) {
    console.error('Audit events error:', error);
    res.status(500).json({
      error: 'Failed to get audit events',
      message: 'Internal server error'
    });
  }
});

/**
 * Get audit statistics (admin only)
 */
router.get('/audit/stats', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const stats = getAuditStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({
      error: 'Failed to get audit statistics',
      message: 'Internal server error'
    });
  }
});

/**
 * Search audit events (admin only)
 */
router.get('/audit/search', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: 'Search query required',
        message: 'Please provide a search query'
      });
    }

    const events = searchAuditEvents(q);
    res.json({
      success: true,
      events,
      total: events.length,
      query: q
    });
  } catch (error) {
    console.error('Audit search error:', error);
    res.status(500).json({
      error: 'Failed to search audit events',
      message: 'Internal server error'
    });
  }
});

/**
 * Export audit events (admin only)
 */
router.get('/audit/export', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    if (!authenticatedReq.user.is_admin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    const { type, severity, userId, startTime, endTime, success, resource } = req.query;
    const filter = {
      type: type as AuditEventType,
      severity: severity as AuditSeverity,
      userId: userId as string,
      startTime: startTime as string,
      endTime: endTime as string,
      success: success === 'true',
      resource: resource as string
    };

    const csvData = exportAuditEvents(filter);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_events_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvData);
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({
      error: 'Failed to export audit events',
      message: 'Internal server error'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export { router as authRouter }; 