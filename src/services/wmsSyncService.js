const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const wmsAutomation = require('./wmsAutomation');

const prisma = new PrismaClient();
const isDev = process.env.NODE_ENV !== 'production';

const MAX_CONCURRENT_SYNCS = 5;

// Shared browser instance (one per server)
let browser = null;

// In-memory job tracker: syncLogId -> { status, context }
const activeJobs = new Map();

async function initializeBrowser() {
  if (browser) return;

  const headless = process.env.WMS_HEADLESS !== 'false';

  console.log(`Launching Chromium (headless: ${headless})...`);
  console.log(`PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || '(not set)'}`);

  try {
    browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  } catch (err) {
    console.error('Failed to launch Chromium:', err.message);
    console.error('This usually means Playwright browsers are not installed.');
    console.error('Run: npx playwright install --with-deps chromium');
    throw err;
  }

  console.log(`Playwright browser initialized (headless: ${headless})`);

  // Clean up any stale sync logs from previous server runs
  const stale = await prisma.wmsSyncLog.updateMany({
    where: { status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Server restarted' }
  });
  if (stale.count > 0) {
    console.log(`Cleaned up ${stale.count} stale WMS sync(s)`);
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('Playwright browser closed');
  }
}

async function startSync(timesheetId, wmsCredentials) {
  if (!wmsCredentials || !wmsCredentials.username || !wmsCredentials.password) {
    throw new Error('WMS credentials required');
  }

  if (activeJobs.size >= MAX_CONCURRENT_SYNCS) {
    throw new Error('Too many concurrent syncs. Please try again shortly.');
  }

  // Check for existing in-progress sync
  const existingSync = await prisma.wmsSyncLog.findFirst({
    where: {
      timesheetId,
      status: { in: ['PENDING', 'RUNNING'] }
    }
  });

  if (existingSync) {
    // If there's no matching in-memory job, it's stale — clean it up
    if (!activeJobs.has(existingSync.id)) {
      await prisma.wmsSyncLog.update({
        where: { id: existingSync.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Stale sync cleaned up' }
      });
      console.log(`Cleaned up stale sync log ${existingSync.id} for timesheet ${timesheetId}`);
    } else {
      throw new Error('A sync is already in progress for this timesheet');
    }
  }

  // Fetch timesheet with all related data
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      employee: {
        include: {
          identifiers: true,
          user: true
        }
      },
      entries: {
        include: {
          role: true,
          company: true
        },
        orderBy: { date: 'asc' }
      }
    }
  });

  if (!timesheet) {
    throw new Error('Timesheet not found');
  }

  if (timesheet.entries.length === 0) {
    throw new Error('Timesheet has no entries to sync');
  }

  // Create sync log record
  const syncLog = await prisma.wmsSyncLog.create({
    data: {
      timesheetId,
      status: 'PENDING',
      wmsUsername: wmsCredentials.username
    }
  });

  // Launch async sync (don't await - returns immediately)
  performSync(syncLog.id, timesheet, wmsCredentials).catch(err => {
    console.error(`Sync ${syncLog.id} unhandled error:`, err.message);
  });

  return syncLog;
}

async function performSync(syncLogId, timesheet, credentials) {
  let context = null;

  try {
    await prisma.wmsSyncLog.update({
      where: { id: syncLogId },
      data: { status: 'RUNNING', startedAt: new Date() }
    });

    if (!browser) {
      await initializeBrowser();
    }

    // Create isolated browser context - own cookies, storage, session
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const job = { status: 'RUNNING', context, progress: [] };
    activeJobs.set(syncLogId, job);

    // Progress callback - stores in memory for fast polling
    const onProgress = (message) => {
      const entry = { message, timestamp: new Date().toISOString() };
      job.progress.push(entry);
    };

    // Run automation
    const result = await wmsAutomation.syncTimesheet(context, timesheet, credentials, onProgress);

    await prisma.wmsSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        syncDetails: JSON.stringify(result)
      }
    });
  } catch (error) {
    const details = {
      error: error.message,
      steps: error.steps || [],
      hasScreenshot: !!error.screenshot
    };

    await prisma.wmsSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message,
        syncDetails: JSON.stringify(details)
      }
    });
  } finally {
    // Always close the browser context to free resources
    if (context) {
      await context.close().catch(() => {});
    }
    activeJobs.delete(syncLogId);

    // Credentials go out of scope here - garbage collected
  }
}

async function getSyncStatus(syncLogId) {
  const log = await prisma.wmsSyncLog.findUnique({
    where: { id: syncLogId }
  });

  if (!log) {
    throw new Error('Sync log not found');
  }

  const activeJob = activeJobs.get(syncLogId);
  return {
    ...log,
    isActive: !!activeJob,
    progress: activeJob ? activeJob.progress : []
  };
}

async function getTimesheetSyncs(timesheetId) {
  return await prisma.wmsSyncLog.findMany({
    where: { timesheetId },
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  initializeBrowser,
  closeBrowser,
  startSync,
  getSyncStatus,
  getTimesheetSyncs
};
