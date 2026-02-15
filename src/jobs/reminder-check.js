require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const prisma = new PrismaClient();

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
};

const getEndOfWeek = (startDate) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + 6);
  return d;
};

const checkAndSendReminders = async () => {
  console.log('Running timesheet reminder check...');

  if (process.env.REMINDER_ENABLED !== 'true') {
    console.log('Reminders are disabled in configuration');
    return;
  }

  try {
    // Get current week
    const today = new Date();
    const weekStart = getStartOfWeek(today);
    const weekEnd = getEndOfWeek(weekStart);

    console.log(`Checking timesheets for week: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`);

    // Get all employees
    const employees = await prisma.employee.findMany({
      include: {
        user: true,
        timesheets: {
          where: {
            weekStarting: weekStart
          }
        }
      }
    });

    let remindersSent = 0;

    for (const employee of employees) {
      // Check if employee has a timesheet for this week
      const timesheet = employee.timesheets.find(
        t => t.weekStarting.toDateString() === weekStart.toDateString()
      );

      // If no timesheet or timesheet not submitted, send reminder
      if (!timesheet || (timesheet.status !== 'SUBMITTED' &&
                         timesheet.status !== 'APPROVED' &&
                         timesheet.status !== 'LOCKED' &&
                         timesheet.status !== 'PROCESSED')) {

        const employeeName = `${employee.firstName} ${employee.lastName}`;
        const weekStartStr = weekStart.toLocaleDateString();
        const weekEndStr = weekEnd.toLocaleDateString();

        // Send email reminder
        try {
          await emailService.sendTimesheetReminder(
            employee.email,
            employeeName,
            weekStartStr,
            weekEndStr
          );
          console.log(`Email reminder sent to ${employee.email}`);
          remindersSent++;
        } catch (emailError) {
          console.error(`Failed to send email to ${employee.email}:`, emailError.message);
        }

        // Send SMS reminder if phone number is available
        if (employee.phone) {
          try {
            await smsService.sendTimesheetReminder(
              employee.phone,
              employeeName,
              weekStartStr,
              weekEndStr
            );
            console.log(`SMS reminder sent to ${employee.phone}`);
          } catch (smsError) {
            console.error(`Failed to send SMS to ${employee.phone}:`, smsError.message);
          }
        }
      }
    }

    console.log(`Reminder check complete. Sent ${remindersSent} reminders.`);
  } catch (error) {
    console.error('Error in reminder check:', error);
  } finally {
    await prisma.$disconnect();
  }
};

// If run directly (not imported)
if (require.main === module) {
  checkAndSendReminders()
    .then(() => {
      console.log('Reminder check finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Reminder check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAndSendReminders };
