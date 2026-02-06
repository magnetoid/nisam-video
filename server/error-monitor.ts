import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context: {
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    userId?: string;
    sessionId?: string;
    duration?: number;
    statusCode?: number;
  };
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private errorLog: ErrorLog[] = [];
  private maxLogSize = 1000;
  private errorCounts = new Map<string, number>();
  private lastErrorTimes = new Map<string, Date>();

  /**
   * Generate a unique error ID based on the error message and stack
   */
  private generateErrorId(error: Error, context: Partial<ErrorLog['context']>): string {
    const hashInput = `${error.message}:${error.stack || ''}:${context.url || ''}:${context.method || ''}`;
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Log an error with full context
   */
  logError(error: Error, context: Partial<ErrorLog['context']>, metadata?: Record<string, any>): ErrorLog {
    const errorId = this.generateErrorId(error, context);
    const timestamp = new Date();
    
    const errorLog: ErrorLog = {
      id: errorId,
      timestamp,
      level: 'error',
      message: error.message,
      stack: error.stack,
      context: {
        method: context.method || 'unknown',
        url: context.url || 'unknown',
        userAgent: context.userAgent,
        ip: context.ip,
        userId: context.userId,
        sessionId: context.sessionId,
        duration: context.duration,
        statusCode: context.statusCode,
      },
      metadata,
    };

    // Add to log (maintain max size)
    this.errorLog.push(errorLog);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Update error counts
    const count = this.errorCounts.get(errorId) || 0;
    this.errorCounts.set(errorId, count + 1);
    this.lastErrorTimes.set(errorId, timestamp);

    // Log to console with structured format
    console.error(`[ERROR_MONITOR] ${timestamp.toISOString()} | ${errorId} | ${context.method} ${context.url} | ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }

    return errorLog;
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context: Partial<ErrorLog['context']>, metadata?: Record<string, any>): ErrorLog {
    const timestamp = new Date();
    const warningId = createHash('sha256').update(message).digest('hex').substring(0, 16);
    
    const warningLog: ErrorLog = {
      id: warningId,
      timestamp,
      level: 'warn',
      message,
      context: {
        method: context.method || 'unknown',
        url: context.url || 'unknown',
        userAgent: context.userAgent,
        ip: context.ip,
        userId: context.userId,
        sessionId: context.sessionId,
        duration: context.duration,
        statusCode: context.statusCode,
      },
      metadata,
    };

    this.errorLog.push(warningLog);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    console.warn(`[WARN_MONITOR] ${timestamp.toISOString()} | ${warningId} | ${context.method} ${context.url} | ${message}`);
    
    return warningLog;
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindow: number = 3600000): { // Default 1 hour
    totalErrors: number;
    uniqueErrors: number;
    mostFrequent: Array<{ errorId: string; count: number; lastOccurrence: Date; message: string }>;
    recentErrors: ErrorLog[];
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    const recentErrors = this.errorLog.filter(log => 
      log.level === 'error' && log.timestamp >= windowStart
    );

    const errorFrequency = new Map<string, number>();
    const errorMessages = new Map<string, string>();
    const errorLastOccurrence = new Map<string, Date>();

    recentErrors.forEach(log => {
      const count = errorFrequency.get(log.id) || 0;
      errorFrequency.set(log.id, count + 1);
      errorMessages.set(log.id, log.message);
      errorLastOccurrence.set(log.id, log.timestamp);
    });

    const mostFrequent = Array.from(errorFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([errorId, count]) => ({
        errorId,
        count,
        lastOccurrence: errorLastOccurrence.get(errorId)!,
        message: errorMessages.get(errorId) || 'Unknown error',
      }));

    return {
      totalErrors: recentErrors.length,
      uniqueErrors: errorFrequency.size,
      mostFrequent,
      recentErrors: recentErrors.slice(-20), // Last 20 errors
    };
  }

  /**
   * Express middleware for error monitoring
   */
  errorMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Log the error
      this.logError(error, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: (req as any).user?.id,
        sessionId: (req as any).session?.id,
        duration: Date.now() - startTime,
        statusCode: res.statusCode,
      }, {
        query: req.query,
        body: req.body,
        params: req.params,
      });

      // Continue with default error handling
      next(error);
    };
  }

  /**
   * Express middleware for request monitoring
   */
  requestMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;
      const monitor = this;
      
      const originalSendBound = originalSend.bind(res);
      res.send = (body: any) => {
        const duration = Date.now() - startTime;
        
        // Log slow requests (over 5 seconds)
        if (duration > 5000) {
          monitor.logWarning(`Slow request: ${duration}ms`, {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            duration,
            statusCode: res.statusCode,
          });
        }

        // Log high error rates (5xx status codes)
        if (res.statusCode >= 500) {
          monitor.logWarning(`Server error response: ${res.statusCode}`, {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            duration,
            statusCode: res.statusCode,
          });
        }

        return originalSendBound(body);
      };

      next();
    };
  }

  /**
   * Health check endpoint
   */
  getHealthStatus() {
    const stats = this.getErrorStats(3600000); // 1 hour
    const errorRate = stats.totalErrors / Math.max(1, stats.totalErrors + 100); // Rough calculation
    
    return {
      status: errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy',
      errorRate,
      recentErrors: stats.recentErrors.length,
      uniqueErrors: stats.uniqueErrors,
      mostFrequent: stats.mostFrequent.slice(0, 5),
    };
  }
}

// Export singleton instance
export const errorMonitor = new ErrorMonitor();

/**
 * Wrapper for async route handlers to catch errors automatically
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Retry wrapper for database operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        errorMonitor.logError(lastError, {
          method: 'retry',
          url: operationName,
        }, {
          attempt,
          maxRetries,
          operationName,
        });
        throw lastError;
      }
      
      console.warn(`[RETRY] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
    }
  }
  
  throw lastError!;
}
