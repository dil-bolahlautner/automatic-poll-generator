import jwt from 'jsonwebtoken';

// Use the same secret as the Python backend
const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_ALGORITHM = 'HS256';

export interface JWTPayload {
  sub: string;
  email: string;
  is_admin: boolean;
  exp?: number;
}

export class JWTUtils {
  /**
   * Verify a JWT token issued by the Python backend
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return null;
      }
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Extract user info from token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      console.error('JWT decode failed:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch (error) {
      return true;
    }
  }
} 