require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const SqliteStore = require('better-sqlite3-session-store')(session);
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const employeeRoutes = require('./routes/employees');
const roleRoutes = require('./routes/roles');
const timesheetRoutes = require('./routes/timesheets');
const entryRoutes = require('./routes/entries');
const approverRoutes = require('./routes/approvers');
const mapsRoutes = require('./routes/maps');
const userRoutes = require('./routes/users');
const wmsSyncRoutes = require('./routes/wmsSync');
const apiKeyRoutes = require('./routes/apiKeys');
const tsDataRoutes = require('./routes/tsData');
const xeroRoutes = require('./routes/xero');
const wmsSyncService = require('./services/wmsSyncService');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Trust proxy (required behind Traefik/nginx for secure cookies)
// Enables Express to trust X-Forwarded-Proto from the reverse proxy
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow configured origin or localhost variants
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3000'
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration (SQLite-backed, survives restarts)
const sessionDbPath = process.env.SESSION_DB_PATH || path.join(__dirname, '../prisma/sessions.db');
const sessionDb = new Database(sessionDbPath);
app.use(session({
  store: new SqliteStore({ client: sessionDb, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Custom name to avoid conflicts
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    path: '/'
  }
}));

// Swagger API docs (development only)
if (isDev) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/approvers', approverRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wms-sync', wmsSyncRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/tsdata', tsDataRoutes);
app.use('/api/xero', xeroRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

async function startServer() {
  try {
    await wmsSyncService.initializeBrowser();
  } catch (err) {
    console.warn('Playwright browser init failed (WMS sync will be unavailable):', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Timesheet system running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (isDev) {
      console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
      console.log(`Verbose logging: enabled`);
    }
    startScheduler();
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await wmsSyncService.closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await wmsSyncService.closeBrowser();
  process.exit(0);
});

startServer();
