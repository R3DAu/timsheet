const twilio = require('twilio');

let twilioClient = null;

// Initialize Twilio client only if credentials are provided
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
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
