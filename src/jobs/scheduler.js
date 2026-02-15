require('dotenv').config();
const cron = require('node-cron');
const { checkAndSendReminders } = require('./reminder-check');

// Parse time from config (format: "HH:MM")
const parseCronTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  return { hours: parseInt(hours), minutes: parseInt(minutes) };
};

const startScheduler = () => {
  if (process.env.REMINDER_ENABLED !== 'true') {
    console.log('Reminders are disabled, scheduler not started');
    return;
  }

  const fridayTime = parseCronTime(process.env.REMINDER_FRIDAY_TIME || '18:00');
  const sundayTime = parseCronTime(process.env.REMINDER_SUNDAY_TIME || '18:00');

  // Friday at configured time
  const fridayCron = `${fridayTime.minutes} ${fridayTime.hours} * * 5`;
  cron.schedule(fridayCron, () => {
    console.log('Friday reminder scheduled task triggered');
    checkAndSendReminders();
  });
  console.log(`Friday reminders scheduled for ${process.env.REMINDER_FRIDAY_TIME}`);

  // Sunday at configured time
  const sundayCron = `${sundayTime.minutes} ${sundayTime.hours} * * 0`;
  cron.schedule(sundayCron, () => {
    console.log('Sunday reminder scheduled task triggered');
    checkAndSendReminders();
  });
  console.log(`Sunday reminders scheduled for ${process.env.REMINDER_SUNDAY_TIME}`);
};

module.exports = { startScheduler };
