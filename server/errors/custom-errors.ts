/**
 * Base error class for application-specific errors
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends ApplicationError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', 500, context);
  }
}

/**
 * Validation errors for user input
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { ...context, field });
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends ApplicationError {
  constructor(
    message: string = 'Authentication required',
    context?: Record<string, any>
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(
    message: string = 'Insufficient permissions',
    context?: Record<string, any>
  ) {
    super(message, 'AUTHORIZATION_ERROR', 403, context);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends ApplicationError {
  constructor(
    resource: string,
    identifier?: string | number,
    context?: Record<string, any>
  ) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 'NOT_FOUND_ERROR', 404, { ...context, resource, identifier });
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends ApplicationError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(message, 'BUSINESS_LOGIC_ERROR', 422, context);
  }
}

/**
 * External service errors (APIs, third-party services)
 */
export class ExternalServiceError extends ApplicationError {
  constructor(
    service: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(
      `External service error (${service}): ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { ...context, service }
    );
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ApplicationError {
  constructor(
    limit: number,
    window: string,
    retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(
      `Rate limit exceeded. Limit: ${limit} requests per ${window}`,
      'RATE_LIMIT_ERROR',
      429,
      { ...context, limit, window, retryAfter }
    );
  }
}

/**
 * Error utilities for consistent error handling
 */
export class ErrorUtils {
  /**
   * Convert unknown error to ApplicationError
   */
  static toApplicationError(error: unknown, context?: Record<string, any>): ApplicationError {
    if (error instanceof ApplicationError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApplicationError(
        error.message,
        'UNEXPECTED_ERROR',
        500,
        { ...context, originalError: error.name, stack: error.stack }
      );
    }

    return new ApplicationError(
      'An unexpected error occurred',
      'UNEXPECTED_ERROR',
      500,
      { ...context, originalError: String(error) }
    );
  }

  /**
   * Check if error is a database constraint error
   */
  static isDatabaseConstraintError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('unique constraint') ||
        message.includes('foreign key constraint') ||
        message.includes('check constraint') ||
        message.includes('not null constraint')
      );
    }
    return false;
  }

  /**
   * Extract validation errors from Zod error
   */
  static extractZodErrors(error: any): Array<{ field: string; message: string }> {
    if (error?.issues && Array.isArray(error.issues)) {
      return error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
    }
    return [];
  }
}