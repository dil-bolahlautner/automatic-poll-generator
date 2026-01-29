import { Request, Response, NextFunction } from 'express';
import { JWTUtils, JWTPayload } from '../utils/jwtUtils';
import { validateSession, createSession, refreshSession } from '../utils/sessionUtils';
import { logSecurityEvent, SecurityEventType, detectSuspiciousActivity } from '../utils/securityLogger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

/**
 * Middleware to authenticate requests using JWT tokens from Python backend
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // Check for suspicious activity
  if (detectSuspiciousActivity(req)) {
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please try again later' 
    });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, req, { reason: 'No token provided' }, 'MEDIUM');
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'No authorization token provided' 
    });
  }

  try {
    const decoded = JWTUtils.verifyToken(token);
    if (!decoded) {
      logSecurityEvent(SecurityEventType.INVALID_TOKEN, req, { reason: 'Token verification failed' }, 'HIGH');
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token verification failed' 
      });
    }

    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      logSecurityEvent(SecurityEventType.SESSION_EXPIRED, req, { userId: decoded.sub }, 'MEDIUM');
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Access token has expired' 
      });
    }

    // Validate session - create one if it doesn't exist (for tokens from Python backend)
    let sessionValidation = validateSession(decoded.sub);
    if (!sessionValidation.valid) {
      // Try to create a session for this user (for tokens from Python backend)
      try {
        createSession(decoded);
        sessionValidation = validateSession(decoded.sub);
      } catch (error) {
        console.error('Error creating session:', error);
      }
      
      // If still not valid after creating session, reject
      if (!sessionValidation.valid) {
        logSecurityEvent(SecurityEventType.SESSION_EXPIRED, req, { userId: decoded.sub, reason: 'Session validation failed' }, 'MEDIUM');
        return res.status(401).json({ 
          error: 'Session expired',
          message: 'Your session has expired. Please log in again.' 
        });
      }
    }

    // Check if token needs refresh
    if (sessionValidation.needsRefresh) {
      const refreshedSession = refreshSession(decoded.sub);
      if (refreshedSession) {
        // Add refresh header to response
        res.setHeader('X-Token-Refresh', 'true');
      }
    }

    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or expired token' 
    });
  }
};

/**
 * Middleware to require admin privileges
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'User must be authenticated' 
    });
  }

  if (!req.user.is_admin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'Admin privileges required for this operation' 
    });
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = JWTUtils.verifyToken(token);
      if (decoded && (!decoded.exp || Date.now() < decoded.exp * 1000)) {
        req.user = decoded;
      }
    } catch (error) {
      console.warn('Optional auth failed:', error);
      // Don't fail the request, just don't set user
    }
  }

  next();
}; 