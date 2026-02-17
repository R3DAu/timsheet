require('dotenv').config();
const cron = require('node-cron');
const { checkAndSendReminders } = require('./reminder-check');
const { runTsDataSync } = require('./tsdata-sync');
const { runXeroSyncJob } = require('./xero-sync');
const { runReconciliationJob } = require('./xero-reconciliation');

// Parse time from config (format: "HH:MM")
const parseCronTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  return { hours: parseInt(hours), minutes: parseInt(minutes) };
};

const startScheduler = () => {
  // Reminder jobs
  if (process.env.REMINDER_ENABLED === 'true') {
    const fridayTime = parseCronTime(process.env.REMINDER_FRIDAY_TIME || '18:00');
    const sundayTime = parseCronTime(process.env.REMINDER_SUNDAY_TIME || '18:00');

    const fridayCron = `${fridayTime.minutes} ${fridayTime.hours} * * 5`;
    cron.schedule(fridayCron, () => {
      console.log('Friday reminder scheduled task triggered');
      checkAndSendReminders();
    });
    console.log(`Friday reminders scheduled for ${process.env.REMINDER_FRIDAY_TIME}`);

    const sundayCron = `${sundayTime.minutes} ${sundayTime.hours} * * 0`;
    cron.schedule(sundayCron, () => {
      console.log('Sunday reminder scheduled task triggered');
      checkAndSendReminders();
    });
    console.log(`Sunday reminders scheduled for ${process.env.REMINDER_SUNDAY_TIME}`);
  } else {
    console.log('Reminders are disabled, reminder scheduler not started');
  }

  // TSDATA sync job
  if (process.env.TSDATA_SYNC_ENABLED === 'true') {
    const interval = parseInt(process.env.TSDATA_SYNC_INTERVAL_MINUTES || '30', 10);
    const syncCron = `*/${interval} * * * *`;

    cron.schedule(syncCron, () => {
      console.log('TSDATA sync scheduled task triggered');
      runTsDataSync();
    });
    console.log(`TSDATA sync scheduled every ${interval} minutes`);

    // Optional: run on startup after a short delay
    if (process.env.TSDATA_SYNC_ON_STARTUP === 'true') {
      console.log('TSDATA sync will run on startup in 5 seconds...');
      setTimeout(() => runTsDataSync(), 5000);
    }
  } else {
    console.log('TSDATA sync is disabled');
  }

  // Xero Sync Job (Sunday nights)
  if (process.env.XERO_SYNC_ENABLED === 'true') {
    const syncTime = parseCronTime(process.env.XERO_SYNC_TIME || '22:00');
    const syncCron = `${syncTime.minutes} ${syncTime.hours} * * 0`; // Sunday (0)

    cron.schedule(syncCron, () => {
      console.log('Xero sync scheduled task triggered');
      runXeroSyncJob();
    });
    console.log(`Xero sync scheduled for Sundays at ${process.env.XERO_SYNC_TIME || '22:00'}`);
  } else {
    console.log('Xero sync is disabled');
  }

  // Xero Reconciliation Job (Monday mornings)
  if (process.env.XERO_SYNC_ENABLED === 'true') {
    const reconTime = parseCronTime(process.env.XERO_RECONCILIATION_TIME || '06:00');
    const reconCron = `${reconTime.minutes} ${reconTime.hours} * * 1`; // Monday (1)

    cron.schedule(reconCron, () => {
      console.log('Xero reconciliation scheduled task triggered');
      runReconciliationJob();
    });
    console.log(`Xero reconciliation scheduled for Mondays at ${process.env.XERO_RECONCILIATION_TIME || '06:00'}`);
  } else {
    console.log('Xero reconciliation is disabled');
  }
};

module.exports = { startScheduler };
