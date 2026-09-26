/**
 * Structured Logger
 * Outputs JSON logs suitable for AWS CloudWatch
 */

interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  errorCode?: string;
  errorStack?: string;
  context?: LogContext;
}

class Logger {
  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  info(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...context,
    };
    console.log(this.formatEntry(entry));
  }

  warn(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...context,
    };
    console.warn(this.formatEntry(entry));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      errorStack: error?.stack,
      ...context,
    };
    console.error(this.formatEntry(entry));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        ...context,
      };
      console.debug(this.formatEntry(entry));
    }
  }

  request(
    requestId: string,
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    errorCode?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 400 ? 'WARN' : 'INFO',
      message: `HTTP ${method} ${path} ${statusCode}`,
      requestId,
      userId,
      method,
      path,
      statusCode,
      duration,
      errorCode,
    };
    console.log(this.formatEntry(entry));
  }
}

export const logger = new Logger();
