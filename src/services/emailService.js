const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendTimesheetSubmittedNotification = async (approverEmail, timesheet, approverName) => {
  const weekStart = new Date(timesheet.weekStarting).toLocaleDateString();
  const weekEnd = new Date(timesheet.weekEnding).toLocaleDateString();
  const employeeName = `${timesheet.employee.firstName} ${timesheet.employee.lastName}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: approverEmail,
    subject: `Timesheet Submitted for Approval - ${employeeName}`,
    html: `
      <h2>Timesheet Submitted for Approval</h2>
      <p>Hello ${approverName},</p>
      <p>A timesheet has been submitted for your approval:</p>
      <ul>
        <li><strong>Employee:</strong> ${employeeName}</li>
        <li><strong>Week:</strong> ${weekStart} - ${weekEnd}</li>
        <li><strong>Total Entries:</strong> ${timesheet.entries.length}</li>
        <li><strong>Submitted:</strong> ${new Date(timesheet.submittedAt).toLocaleString()}</li>
      </ul>
      <p>Please log in to the timesheet system to review and approve this timesheet.</p>
      <p>Thank you,<br>Timesheet System</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Notification sent to ${approverEmail}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

const sendTimesheetApprovedNotification = async (employeeEmail, timesheet) => {
  const weekStart = new Date(timesheet.weekStarting).toLocaleDateString();
  const weekEnd = new Date(timesheet.weekEnding).toLocaleDateString();

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: employeeEmail,
    subject: 'Timesheet Approved',
    html: `
      <h2>Timesheet Approved</h2>
      <p>Your timesheet has been approved:</p>
      <ul>
        <li><strong>Week:</strong> ${weekStart} - ${weekEnd}</li>
        <li><strong>Approved By:</strong> ${timesheet.approvedBy.name}</li>
        <li><strong>Approved At:</strong> ${new Date(timesheet.approvedAt).toLocaleString()}</li>
      </ul>
      <p>Thank you,<br>Timesheet System</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Approval notification sent to ${employeeEmail}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

const sendTimesheetReminder = async (employeeEmail, employeeName, weekStart, weekEnd) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: employeeEmail,
    subject: 'Timesheet Submission Reminder',
    html: `
      <h2>Timesheet Submission Reminder</h2>
      <p>Hello ${employeeName},</p>
      <p>This is a friendly reminder that you have not yet submitted your timesheet for:</p>
      <ul>
        <li><strong>Week:</strong> ${weekStart} - ${weekEnd}</li>
      </ul>
      <p>Please log in to the timesheet system and submit your timesheet as soon as possible.</p>
      <p>Thank you,<br>Timesheet System</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reminder sent to ${employeeEmail}`);
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    throw error;
  }
};

module.exports = {
  sendTimesheetSubmittedNotification,
  sendTimesheetApprovedNotification,
  sendTimesheetReminder
};
