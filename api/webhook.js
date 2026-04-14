import * as line from '@line/bot-sdk';
import { connectDB } from '../models/db.js';
import { UserState } from '../models/UserState.js';
import { FlightAlert } from '../models/FlightAlert.js';
import { t, COMMANDS, checkCmd } from '../utils/messages.js';

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

  let user = await UserState.findOne({ lineUserId: userId });
  if (!user) {
    user = await UserState.create({ lineUserId: userId });
  }

  async function reply(text) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text }]
    });
  }

  const text = userText;
  const lang = user.language || 'ko';

  if (checkCmd(text, COMMANDS.CANCEL)) {
    user.step = 0;
    user.tempData = {};
    await user.save();
    return reply(t(lang, 'cancel'));
  }

  if (checkCmd(text, COMMANDS.LANG_KO)) {
    user.language = "ko";
    user.currency = "KRW";
    await user.save();
    return reply(t('ko', 'change_lang_ko'));
  }

  if (checkCmd(text, COMMANDS.LANG_JA)) {
    user.language = "ja";
    user.currency = "JPY";
    await user.save();
    return reply(t('ja', 'change_lang_ja'));
  }

  if (checkCmd(text, COMMANDS.LANG_CHANGE)) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: t(lang, 'lang_prompt_line'),
        quickReply: {
          items: [
            { type: "action", action: { type: "message", label: "🇰🇷 한국어(KRW)", text: "한국어" } },
            { type: "action", action: { type: "message", label: "🇯🇵 日本語(JPY)", text: "日本語" } }
          ]
        }
      }]
    });
  }

  if (user.step === 5) {
    return reply(t(lang, 'cmd_unknown'));
  }

  if (checkCmd(text, COMMANDS.LIST)) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    if (alerts.length === 0) return reply(t(lang, 'no_alert'));
    const listMsg = alerts.map((a, idx) => `${idx + 1}. [${a.departure_id}->${a.arrival_id}] ${a.outbound_date} (${a.target_price.toLocaleString()} ${user.currency})`).join('\n');
    return reply(`${t(lang, 'list_header')}${listMsg}`);
  }

  if (checkCmd(text, COMMANDS.DELETE)) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    if (alerts.length === 0) return reply(t(lang, 'no_alert'));
    const listMsg = alerts.map((a, idx) => `${idx + 1}. [${a.departure_id}->${a.arrival_id}] ${a.outbound_date}`).join('\n');
    user.step = 10;
    await user.save();
    return reply(`${t(lang, 'del_prompt')}\n\n${listMsg}`);
  }

  if (user.step === 10) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    const idx = Number(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= alerts.length) {
      return reply(t(lang, 'invalid_num'));
    }
    await FlightAlert.deleteOne({ _id: alerts[idx]._id });
    user.step = 0;
    await user.save();
    return reply(t(lang, 'deleted'));
  }

  if (user.step === 0) {
    if (checkCmd(text, COMMANDS.REGISTER)) {
      user.step = 1;
      user.tempData = {};
      await user.save();
      return reply(t(lang, 'dep'));
    } else {
      return reply(t(lang, 'cmd_unknown'));
    }
  }

  if (user.step === 1) {
    user.tempData.departure_id = text.toUpperCase();
    user.step = 2;
    await user.save();
    return reply(t(lang, 'arr'));
  }

  if (user.step === 2) {
    user.tempData.arrival_id = text.toUpperCase();
    user.step = 3;
    await user.save();
    return reply(t(lang, 'date'));
  }

  if (user.step === 3) {
    user.tempData.outbound_date = text;
    user.step = 4;
    await user.save();
    return reply(t(lang, 'price', { currency: user.currency }));
  }

  if (user.step === 4) {
    const targetPrice = Number(text);
    if (isNaN(targetPrice)) return reply(t(lang, 'price_err'));

    await FlightAlert.create({
      lineUserId: userId,
      departure_id: user.tempData.departure_id,
      arrival_id: user.tempData.arrival_id,
      outbound_date: user.tempData.outbound_date,
      target_price: targetPrice
    });

    user.step = 0;
    user.tempData = {};
    await user.save();

    return reply(`${t(lang, 'done')}\n${user.tempData.departure_id} -> ${user.tempData.arrival_id} (${targetPrice.toLocaleString()} ${user.currency})`);
  }
}
