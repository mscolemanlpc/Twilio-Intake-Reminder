require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const MESSAGES = [
  {
    delayMs: 0,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please respond to the email that was sent to the email address you provided. From the email, 1) accept the invitation to the client portal and 2) complete the intake forms within the next 12 hours to prevent cancellation."
  },
  {
    delayMs: 4 * 60 * 60 * 1000,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please respond to the email that was sent to the email address you provided. From the email, 1) accept the invitation to the client portal and 2) complete the intake forms within the next 8 hours to prevent cancellation."
  },
  {
    delayMs: 8 * 60 * 60 * 1000,
    text: "Thanks for requesting an appointment with Michelle Coleman, LPC. To confirm your appointment, please respond to the email that was sent to the email address you provided. From the email, 1) accept the invitation to the client portal and 2) complete the intake forms within the next 4 hours to prevent cancellation."
  }
];

// Store active clients and their timers in memory
const activeClients = {};

async function sendMessage(to, body) {
  await client.messages.create({
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    to,
    body
  });
}

function scheduleReminders(name, phone) {
  console.log(`Scheduling reminders for ${name} (${phone})`);
  const key = phone.replace(/\D/g, '');
  const timers = [];

  MESSAGES.forEach((msg, index) => {
    const timer = setTimeout(async () => {
      if (!activeClients[key]) {
        console.log(`Reminders cancelled for ${name} — skipping message ${index + 1}`);
        return;
      }
      try {
        await sendMessage(phone, msg.text);
        console.log(`Message ${index + 1} sent to ${name}`);
        if (index === MESSAGES.length - 1) {
          delete activeClients[key];
        }
      } catch (err) {
        console.error(`Failed to send message ${index + 1} to ${name}:`, err.message);
      }
    }, msg.delayMs);
    timers.push(timer);
  });

  activeClients[key] = { name, phone, timers };
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

app.post('/cancel-client', (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  const key = phone.replace(/\D/g, '');
  const clientData = activeClients[key];

  if (!clientData) {
    return res.status(404).json({ error: 'No active reminders found for that phone number.' });
  }

  const nameMatch = clientData.name.toLowerCase().trim() === name.toLowerCase().trim();
  if (!nameMatch) {
    return res.status(404).json({ error: 'Name does not match the phone number on file.' });
  }

  clientData.timers.forEach(t => clearTimeout(t));
  delete activeClients[key];

  console.log(`Reminders cancelled for ${name} (${phone})`);
  res.json({ success: true, message: `Reminders cancelled for ${name}.` });
});

app.get('/active-clients', (req, res) => {
  const list = Object.values(activeClients).map(c => ({ name: c.name, phone: c.phone }));
  res.json(list);
});

app.post('/send-one-time', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required.' });
  }

  if (!phone.match(/^\+1\d{10}$/)) {
    return res.status(400).json({ error: 'Phone must be in format +1XXXXXXXXXX.' });
  }

  try {
    await sendMessage(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message. Check your Twilio credentials.' });
  }
});

app.post('/incoming', (req, res) => {
  const incomingBody = (req.body.Body || '').trim().toUpperCase();
  if (incomingBody === 'STOP' || incomingBody === 'UNSTOP' || incomingBody === 'HELP') {
    return res.set('Content-Type', 'text/xml').send('<Response></Response>');
  }
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>This number is for outbound notifications only and is not monitored. Please contact the office from your client portal for assistance.</Message>
</Response>`;
  res.set('Content-Type', 'text/xml').send(twiml);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
