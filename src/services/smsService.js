const twilio = require('twilio');

let twilioClient = null;

// Initialize Twilio client only if valid credentials are provided
// Account SID must start with 'AC'
if (process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('Twilio SMS service initialized');
  } catch (error) {
    console.warn('Failed to initialize Twilio:', error.message);
  }
} else {
  console.log('Twilio not configured - SMS reminders disabled');
}

const sendTimesheetReminder = async (phoneNumber, employeeName, weekStart, weekEnd) => {
  if (!twilioClient) {
    console.warn('Twilio not configured, skipping SMS');
    return;
  }

  if (!phoneNumber) {
    console.warn('No phone number provided, skipping SMS');
    return;
  }

  const message = `Hi ${employeeName}, this is a reminder to submit your timesheet for ${weekStart} - ${weekEnd}. Please log in to the timesheet system. Thank you!`;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`SMS reminder sent to ${phoneNumber}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
};

module.exports = {
  sendTimesheetReminder
};
