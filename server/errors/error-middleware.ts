import { Request, Response, NextFunction } from 'express';
import { 
  ApplicationError, 
  ValidationError, 
  NotFoundError,
  RateLimitError,
  ErrorUtils 
} from './custom-errors.js';
import { recordError } from '../error-log-service.js';

/**
 * Error handling middleware that provides consistent error responses
 */
export function errorHandlerMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Convert unknown error to ApplicationError
  const appError = ErrorUtils.toApplicationError(error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: (req as any).sessionID
  });

  // Log the error for monitoring
  recordError({
    level: appError.statusCode >= 500 ? 'error' : 'warn',
    type: appError.code.toLowerCase().replace(/_/g, '_'),
    message: appError.message,
    stack: appError.stack,
    module: 'api',
    url: req.originalUrl,
    method: req.method,
    statusCode: appError.statusCode,
    sessionId: (req as any).sessionID,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    context: appError.context
  });

  // Send standardized error response
  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: appError.stack,
        context: appError.context 
      })
    }
  });
}

/**
 * Async error wrapper to handle promise rejections in route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler for Zod validation errors
 */
export function validationErrorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  if (error?.issues && Array.isArray(error.issues)) {
    const validationErrors = ErrorUtils.extractZodErrors(error);
    const validationError = new ValidationError(
      'Validation failed',
      undefined,
      { errors: validationErrors }
    );
    return errorHandlerMiddleware(validationError, req, res, next);
  }
  next(error);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  const notFoundError = new NotFoundError('Resource', req.originalUrl);
  
  recordError({
    level: 'warn',
    type: 'not_found',
    message: notFoundError.message,
    module: 'api',
    url: req.originalUrl,
    method: req.method,
    statusCode: 404,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    }
  });
}

/**
 * Rate limiting error handler
 */
export function rateLimitErrorHandler(
  limit: number,
  window: string,
  retryAfter?: number
) {
  return (req: Request, res: Response) => {
    const rateLimitError = new RateLimitError(limit, window, retryAfter);
    
    recordError({
      level: 'warn',
      type: 'rate_limit_exceeded',
      message: rateLimitError.message,
      module: 'api',
      url: req.originalUrl,
      method: req.method,
      statusCode: 429,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: rateLimitError.message,
        retryAfter
      }
    });
  };
}
