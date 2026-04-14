import * as line from '@line/bot-sdk';
import { connectDB } from '../models/db.js';
import { processUserMessage } from '../controllers/chatController.js';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient(config);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Webhook is running');
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  await connectDB();

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).end();
  }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const userText = event.message.text.trim();

  const adapter = {
    sendText: async (text) => {
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text }]
      });
    },
    sendQuickReply: async (text, items) => {
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "text",
          text: text,
          quickReply: { items }
        }]
      });
    }
  };

  try {
    await processUserMessage(userId, userText, adapter);
  } catch (err) {
    console.error("❌ Error processing LINE event:", err);
  }
}
