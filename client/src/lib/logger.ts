type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error | unknown;
}

class Logger {
  private level: LogLevel = 'info';

  constructor() {
    // Check local storage for debug level override
    const storedLevel = localStorage.getItem('logLevel') as LogLevel;
    if (storedLevel && ['debug', 'info', 'warn', 'error'].includes(storedLevel)) {
      this.level = storedLevel;
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
    localStorage.setItem('logLevel', level);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatError(error: unknown): any {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error
      };
    }
    return error;
  }

  private write(level: LogLevel, message: string, context?: Record<string, any>, error?: unknown) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? this.formatError(error) : undefined
    };

    const style = {
      debug: 'color: #3498db',
      info: 'color: #2ecc71',
      warn: 'color: #f1c40f',
      error: 'color: #e74c3c'
    }[level];

    console.groupCollapsed(`%c[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, style);
    if (context) console.log('Context:', context);
    if (error) console.error('Error:', error);
    console.groupEnd();
  }

  debug(message: string, context?: Record<string, any>) {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: unknown) {
    this.write('warn', message, context, error);
  }

  error(message: string, error?: unknown, context?: Record<string, any>) {
    this.write('error', message, context, error);
  }
}

export const logger = new Logger();
