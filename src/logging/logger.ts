import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import type { FrameworkConfig } from '../config/manager.js';
import { redactString, redactValue } from './redactor.js';

export interface FrameworkLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
  child(bindings: Record<string, unknown>): FrameworkLogger;
}

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

function shouldLog(configLevel: string, messageLevel: string): boolean {
  const configIdx = LOG_LEVELS.indexOf(configLevel as typeof LOG_LEVELS[number]);
  const msgIdx = LOG_LEVELS.indexOf(messageLevel as typeof LOG_LEVELS[number]);
  return msgIdx >= (configIdx === -1 ? 2 : configIdx);
}

export function createLogger(config: FrameworkConfig, testName?: string): FrameworkLogger {
  const logDir = path.join(config.outputDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, testName ? `${sanitizeFileName(testName)}.log` : 'framework.log');

  const pinoLogger = pino(
    {
      level: config.logLevel,
      formatters: {
        log(obj) {
          if (config.redactSecrets) {
            return redactValue(obj) as Record<string, unknown>;
          }
          return obj;
        }
      }
    },
    pino.destination({ dest: logFile, sync: false })
  );

  const write = (level: typeof LOG_LEVELS[number], message: string, data?: unknown) => {
    if (!shouldLog(config.logLevel, level)) return;
    const payload = data !== undefined
      ? config.redactSecrets ? redactValue(data) : data
      : undefined;
    const msg = config.redactSecrets ? redactString(message) : message;
    pinoLogger[level](payload ?? {}, msg);
  };

  return {
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data),
    debug: (message, data) => write('debug', message, data),
    child: (bindings) => createLogger({ ...config, logLevel: config.logLevel }, String(bindings.testName ?? testName))
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
}
