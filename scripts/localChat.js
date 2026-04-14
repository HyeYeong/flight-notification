import dotenv from "dotenv";
import * as readline from "readline";
import { connectDB } from "../models/db.js";
import { processUserMessage } from "../controllers/chatController.js";

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
  const adapter = {
    sendText: async (text) => {
      // CLI에선 특수 문법으로 출력된 경우 일반 텍스트로 치환 (예: Quick Reply 안내문 정리)
      const cleanText = text.replace(/또는 아래 버튼을 눌러주세요.+$/, "").replace(/または下のボタン.+$/, "").trim();
      return replyMessage(cleanText);
    },
    sendQuickReply: async (text, items) => {
      // CLI에서는 버튼 대신 '[옵션1 / 옵션2]' 텍스트를 출력
      const optionsText = items.map(item => item.action.text || item.action.label).join(" / ");
      const cleanText = text.replace(/또는 아래 버튼을 눌러주세요.+$/, "").replace(/または下のボタン.+$/, "").trim();
      return replyMessage(`${cleanText}\n🔘 옵션: [ ${optionsText} ]`);
    }
  };

  try {
    await processUserMessage(MOCK_LINE_USER_ID, userText, adapter);
  } catch (err) {
    console.error("❌ Error while processing message:", err);
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
