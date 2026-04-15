import dotenv from "dotenv";
import * as readline from "readline";
import { connectDB } from "../models/db.js";
import { FlightAlert } from "../models/FlightAlert.js";

// 관리자용 스크립트이므로 기본적으로 로컬 DB 사용 (.env.local)
dotenv.config({ path: ".env.local" });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log("🛠️ [관리자 전용] 데이터베이스 청소 유틸리티");
  await connectDB();

  console.log("\n어떤 데이터를 삭제하시겠습니까?");
  console.log("1. 모든 알림 데이터 비우기 (⚠️ 주의)");
  console.log("2. 특정 유저(LINE User ID)의 알림만 비우기");
  console.log("3. 형식이 안 맞는 불량/과거 데이터 비우기 (오는 날짜가 없는 왕복 티켓 등)");
  console.log("0. 종료");

  const choice = await askQuestion("\n선택 (0-3): ");

  try {
    if (choice === "1") {
      const confirm = await askQuestion("정말로 '모든 알림'을 삭제하시겠습니까? (y/n): ");
      if (confirm.toLowerCase() === "y") {
        const res = await FlightAlert.deleteMany({});
        console.log(`✅ 모든 알림 삭제 완료! (${res.deletedCount}개)`);
      } else {
        console.log("취소되었습니다.");
      }
    } else if (choice === "2") {
      const userId = await askQuestion("삭제할 유저의 LINE User ID를 입력하세요: ");
      if (userId.trim()) {
        const res = await FlightAlert.deleteMany({ lineUserId: userId.trim() });
        console.log(`✅ 해당 유저의 알림 삭제 완료! (${res.deletedCount}개)`);
      } else {
        console.log("올바르지 않은 ID입니다. 취소되었습니다.");
      }
    } else if (choice === "3") {
      const res = await FlightAlert.deleteMany({
        $or: [
          // 1. 왕복(1)인데 리턴 날짜가 빈 값인 경우
          {
            flight_type: 1,
            $or: [{ return_date: { $exists: false } }, { return_date: null }, { return_date: "" }]
          },
          // 2. 출발지, 도착지가 없는 경우
          { departure_id: { $exists: false } },
          { arrival_id: { $exists: false } }
        ]
      });
      console.log(`✅ 불량/과거 데이터 자동 청소 완료! (${res.deletedCount}개)`);
    } else {
      console.log("종료합니다.");
    }
  } catch (err) {
    console.error("❌ 에러 발생:", err);
  }

  process.exit(0);
}

main();
