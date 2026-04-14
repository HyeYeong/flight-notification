import dotenv from "dotenv";
import * as readline from "readline";
import { connectDB } from "../models/db.js";
import { UserState } from "../models/UserState.js";
import { FlightAlert } from "../models/FlightAlert.js";
import { t, COMMANDS, checkCmd } from "../utils/messages.js";

dotenv.config({ path: ".env.local" });

const MOCK_LINE_USER_ID = process.env.LINE_USER_ID || "U_local_tester_123";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function replyMessage(text) {
  console.log(`\n🤖 [Bot answer]:\n${text}\n--------------------`);
}

async function handleMessage(userText) {
  let user = await UserState.findOne({ lineUserId: MOCK_LINE_USER_ID });
  if (!user) {
    user = await UserState.create({ lineUserId: MOCK_LINE_USER_ID });
  }

  const text = userText.trim();
  const lang = user.language || 'ko';

  if (checkCmd(text, COMMANDS.CANCEL)) {
    user.step = 0;
    user.tempData = {};
    await user.save();
    return replyMessage(t(lang, 'cancel'));
  }

  if (checkCmd(text, COMMANDS.LANG_KO)) {
    user.language = "ko";
    user.currency = "KRW";
    await user.save();
    return replyMessage(t('ko', 'change_lang_ko'));
  }

  if (checkCmd(text, COMMANDS.LANG_JA)) {
    user.language = "ja";
    user.currency = "JPY";
    await user.save();
    return replyMessage(t('ja', 'change_lang_ja'));
  }

  if (checkCmd(text, COMMANDS.LANG_CHANGE)) {
    user.step = 5;
    return replyMessage(t(lang, 'lang_prompt_cli'));
  }

  if (user.step === 5) {
    // Already handled above if it matches KO or JA commands, but if it doesn't:
    return replyMessage(t(lang, 'cmd_unknown'));
  }

  if (checkCmd(text, COMMANDS.LIST)) {
    const alerts = await FlightAlert.find({ lineUserId: MOCK_LINE_USER_ID, isActive: true });
    if (alerts.length === 0) return replyMessage(t(lang, 'no_alert'));
    const listMsg = alerts.map((a, idx) => `${idx + 1}. [${a.departure_id}->${a.arrival_id}] ${a.outbound_date} (${a.target_price.toLocaleString()} ${user.currency})`).join('\n');
    return replyMessage(`${t(lang, 'list_header')}${listMsg}`);
  }

  if (checkCmd(text, COMMANDS.DELETE)) {
    const alerts = await FlightAlert.find({ lineUserId: MOCK_LINE_USER_ID, isActive: true });
    if (alerts.length === 0) return replyMessage(t(lang, 'no_alert'));
    const listMsg = alerts.map((a, idx) => `${idx + 1}. [${a.departure_id}->${a.arrival_id}] ${a.outbound_date}`).join('\n');
    user.step = 10;
    await user.save();
    return replyMessage(`${t(lang, 'del_prompt')}\n\n${listMsg}`);
  }

  if (user.step === 10) {
    const alerts = await FlightAlert.find({ lineUserId: MOCK_LINE_USER_ID, isActive: true });
    const idx = Number(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= alerts.length) {
      return replyMessage(t(lang, 'invalid_num'));
    }
    await FlightAlert.deleteOne({ _id: alerts[idx]._id });
    user.step = 0;
    await user.save();
    return replyMessage(t(lang, 'deleted'));
  }

  if (user.step === 0) {
    if (checkCmd(text, COMMANDS.REGISTER)) {
      user.step = 1;
      user.tempData = {};
      await user.save();
      return replyMessage(t(lang, 'dep'));
    } else {
      return replyMessage(t(lang, 'cmd_unknown'));
    }
  }

  if (user.step === 1) {
    user.tempData.departure_id = text.toUpperCase();
    user.step = 2;
    await user.save();
    return replyMessage(t(lang, 'arr'));
  }

  if (user.step === 2) {
    user.tempData.arrival_id = text.toUpperCase();
    user.step = 3;
    await user.save();
    return replyMessage(t(lang, 'date'));
  }

  if (user.step === 3) {
    user.tempData.outbound_date = text;
    user.step = 4;
    await user.save();
    return replyMessage(t(lang, 'price', { currency: user.currency }));
  }

  if (user.step === 4) {
    const targetPrice = Number(text);
    if (isNaN(targetPrice)) return replyMessage(t(lang, 'price_err'));

    await FlightAlert.create({
      lineUserId: MOCK_LINE_USER_ID,
      departure_id: user.tempData.departure_id,
      arrival_id: user.tempData.arrival_id,
      outbound_date: user.tempData.outbound_date,
      target_price: targetPrice
    });

    user.step = 0;
    user.tempData = {};
    await user.save();

    return replyMessage(`${t(lang, 'done')}\n${user.tempData.departure_id} -> ${user.tempData.arrival_id} (${targetPrice.toLocaleString()} ${user.currency})`);
  }
}

async function startChat() {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI 가 .env.local 파일에 설정되어 있지 않습니다!");
    console.error("💡 MongoDB Atlas에서 무료 클러스터를 생성하고 Connection String을 넣어주세요.");
    process.exit(1);
  }
  await connectDB();
  console.log("\n💬 Start Local Chatbot Simulator\n");
  console.log(`current user ID: ${MOCK_LINE_USER_ID}`);
  console.log("\n대화를 시작하려면 터미널에 메시지를 입력하고 엔터를 누르세요. (종료: Ctrl+C)\n会話を開始するには、ターミナルにメッセージを入力してEnterキーを押してください。(終了: Ctrl+C)\n");
  console.log("‼️ 입력 예시: 등록, 목록, 삭제, 언어변경\n入力例: 登録, リスト, 削除, 言語変更(add alert, list, delete, lang)\n");

  const loop = async () => {
    const input = await askQuestion("> You: ");
    await handleMessage(input);
    loop();
  };
  loop();
}

startChat();
