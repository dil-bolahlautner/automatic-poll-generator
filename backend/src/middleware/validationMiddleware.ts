import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid input data',
      details: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for JIRA ticket operations
 */
export const validateTicketKey = [
  param('ticketKey')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Z]+-\d+$/)
    .withMessage('Ticket key must be in format PROJECT-123'),
  handleValidationErrors
];

export const validateTicketSearch = [
  query('query')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('maxResults must be between 1 and 100'),
  handleValidationErrors
];

/**
 * Validation rules for Planning Poker sessions
 */
export const validateSessionId = [
  param('sessionId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Session ID must contain only alphanumeric characters, hyphens, and underscores'),
  handleValidationErrors
];

export const validateCreateSession = [
  body('hostId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Host ID is required and must be between 1 and 100 characters'),
  body('hostName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Host name is required and must be between 1 and 100 characters'),
  handleValidationErrors
];

export const validateJoinSession = [
  body('userId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('User ID is required and must be between 1 and 100 characters'),
  body('userName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('User name is required and must be between 1 and 100 characters'),
  handleValidationErrors
];

export const validateVote = [
  body('vote')
    .isString()
    .trim()
    .isIn(['1', '2', '3', '5', '8', '13', '21', '?', 'No answer by host'])
    .withMessage('Vote must be a valid story point value or special value'),
  handleValidationErrors
];

/**
 * Validation rules for Confluence operations
 */
export const validateConfluenceCredentials = [
  body('username')
    .isEmail()
    .normalizeEmail()
    .withMessage('Username must be a valid email address'),
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  handleValidationErrors
];

export const validateGenerateTable = [
  body('tickets')
    .isArray({ min: 1, max: 100 })
    .withMessage('Tickets must be an array with 1-100 items'),
  body('tickets.*.key')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Z]+-\d+$/)
    .withMessage('Each ticket must have a valid key in format PROJECT-123'),
  body('tickets.*.summary')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Each ticket must have a summary between 1 and 500 characters'),
  handleValidationErrors
];

/**
 * Validation rules for Teams operations
 */
export const validateCreatePoll = [
  body('question')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Question must be between 1 and 500 characters'),
  body('options')
    .isArray({ min: 2, max: 10 })
    .withMessage('Options must be an array with 2-10 items'),
  body('options.*')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each option must be between 1 and 200 characters'),
  handleValidationErrors
];

/**
 * Validation rules for general API operations
 */
export const validatePagination = [
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

/**
 * Sanitization middleware for XSS prevention
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize string inputs
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
      .trim();
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    });
  }

  next();
}; 