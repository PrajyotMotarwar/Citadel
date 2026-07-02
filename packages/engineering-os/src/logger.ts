import type { Logger } from './contracts';

export class JsonLogger implements Logger {
  constructor(private readonly sink: (line: string) => void = console.log) {}

  debug(message: string, context: Record<string, unknown> = {}): void {
    this.write('debug', message, context);
  }

  info(message: string, context: Record<string, unknown> = {}): void {
    this.write('info', message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.write('warn', message, context);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.write('error', message, context);
  }

  private write(level: string, message: string, context: Record<string, unknown>): void {
    this.sink(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
  }
}
