import fs from 'fs';
import path from 'path';

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
  private logDir: string;
  private fileLoggingEnabled: boolean = true;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      this.fileLoggingEnabled = false;
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatError(error: unknown): any {
    if (error instanceof Error) {
      const { message, name, stack, ...rest } = error as Error & Record<string, unknown>;
      return {
        message,
        stack,
        name,
        ...rest
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

    // Console output (pretty for dev, JSON for prod)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      const color = {
        debug: '\x1b[34m', // Blue
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m'  // Red
      }[level];
      const reset = '\x1b[0m';
      
      console.log(`${color}[${entry.timestamp}] [${level.toUpperCase()}]${reset} ${message}`);
      if (context) console.log(context);
      if (error) console.error(error);
    }

    // File output (append to daily log)
    if (this.fileLoggingEnabled) {
      try {
        const date = entry.timestamp.split('T')[0];
        const logFile = path.join(this.logDir, `${date}.log`);
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
      } catch {
        this.fileLoggingEnabled = false;
      }
    }
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
