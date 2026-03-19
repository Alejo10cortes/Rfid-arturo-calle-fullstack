// src/config/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from './env';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

const fileTransport = new DailyRotateFile({
  filename:    path.join('logs', '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize:     '20m',
  maxFiles:    '14d',
  level:       'info',
  format:      combine(timestamp(), errors({ stack: true }), json()),
});

const errorFileTransport = new DailyRotateFile({
  filename:    path.join('logs', '%DATE%-error.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize:     '20m',
  maxFiles:    '30d',
  level:       'error',
  format:      combine(timestamp(), errors({ stack: true }), json()),
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    env.NODE_ENV !== 'production'
      ? new winston.transports.Console({
          format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat),
        })
      : new winston.transports.Console({ format: combine(timestamp(), json()) }),
    fileTransport,
    errorFileTransport,
  ],
});
