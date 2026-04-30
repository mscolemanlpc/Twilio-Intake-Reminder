require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const MESSAGES = [
  {
    delayMs: 0,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please (1) accept the invitation to the client portal and (2) complete the intake forms within the next 12 hours to prevent cancellation."
  },
  {
    delayMs: 4 * 60 * 60 * 1000,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please (1) accept the invitation to the client portal and (2) complete the intake forms within the next 8 hours to prevent cancellation."
  },
  {
    delayMs: 8 * 60 * 60 * 1000,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please (1) accept the invitation to the client portal and (2) complete the intake forms within the next 4 hours to prevent cancellation."
  }
];

async function sendMessage(to, body) {
  await client.messages.create({
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to,
    body
  });
}

function scheduleReminders(name, phone) {
  console.log(`Scheduling reminders for ${name} (${phone})`);

  MESSAGES.forEach((msg, index) => {
    setTimeout(async () => {
      try {
        await sendMessage(phone, msg.text);
        console.log(`Message ${index + 1} sent to ${name} at ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.error(`Failed to send message ${index + 1} to ${name}:`, err.message);
      }
    }, msg.delayMs);
  });
}

app.post('/add-client', (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  if (!phone.match(/^\+1\d{10}$/)) {
    return res.status(400).json({ error: 'Phone must be in format +1XXXXXXXXXX.' });
  }

  scheduleReminders(name, phone);
  res.json({ success: true, message: `Reminder sequence started for ${name}.` });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
