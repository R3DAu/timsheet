/**
 * Structured application logger using Winston.
 * - Development: colorized console output
 * - Production: JSON to console + daily rotating log files in /app/logs/
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';
const LOG_DIR = process.env.LOG_DIR || (isDev
  ? path.join(__dirname, '../../logs')
  : '/app/logs');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ── Formats ──────────────────────────────────────────────────────────────────

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} ${level}: ${stack || message}${extra}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Transports ────────────────────────────────────────────────────────────────

const transports = [
  new winston.transports.Console({
    format: isDev ? devFormat : prodFormat,
    // In production suppress DEBUG/verbose unless LOG_LEVEL overrides
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  }),
];

if (!isDev) {
  // Application log — rotated daily, kept 14 days, max 20 MB per file
  transports.push(new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: prodFormat,
    level: process.env.LOG_LEVEL || 'info',
  }));

  // Error-only log
  transports.push(new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: prodFormat,
    level: 'error',
  }));
}

// ── Logger instance ───────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transports,
  // Don't exit on handled errors
  exitOnError: false,
});

// Convenience stream for morgan (HTTP request logging)
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
