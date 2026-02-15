require('dotenv').config();
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const employeeRoutes = require('./routes/employees');
const roleRoutes = require('./routes/roles');
const timesheetRoutes = require('./routes/timesheets');
const entryRoutes = require('./routes/entries');
const approverRoutes = require('./routes/approvers');
const mapsRoutes = require('./routes/maps');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/approvers', approverRoutes);
app.use('/api/maps', mapsRoutes);

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

app.listen(PORT, () => {
  console.log(`Timesheet system running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start reminder scheduler
  startScheduler();
});
