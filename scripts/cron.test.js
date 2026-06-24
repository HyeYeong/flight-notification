import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import axios from "axios";

// 환경변수 모킹
process.env.CRON_SECRET = "test_cron_secret";
process.env.SERP_API_KEY = "test_serp_api_key";
process.env.ENABLE_LINE_MESSAGE = "false";
process.env.MONGODB_URI = "mongodb://localhost:27017/test_db";

// 몽고디비 연결 함수 Mocking (아무것도 하지 않음)
import { connectDB } from "../models/db.js";
mongoose.connect = async () => {
  return {
    connections: [{ readyState: 1 }]
  };
};

// Mongoose 모델의 쿼리 메서드 Mocking
import { FlightAlert } from "../models/FlightAlert.js";
import { UserState } from "../models/UserState.js";

// Mock 데이터 정의
const mockAlerts = [
  {
    _id: "alert_round_trip",
    lineUserId: "user_1",
    departure_id: "ICN",
    arrival_id: "NRT",
    outbound_date: "2026-07-20",
    return_date: "2026-07-27",
    flight_type: 1, // 왕복
    target_price: 300000,
    isActive: true
  },
  {
    _id: "alert_one_way",
    lineUserId: "user_2",
    departure_id: "ICN",
    arrival_id: "NRT",
    outbound_date: "2026-07-20",
    flight_type: 2, // 편도
    target_price: 150000,
    isActive: true
  }
];

const mockUsers = {
  user_1: { lineUserId: "user_1", language: "ko", currency: "KRW" },
  user_2: { lineUserId: "user_2", language: "ko", currency: "KRW" }
};

// DB 조회 모킹
FlightAlert.find = async (query) => {
  assert.deepStrictEqual(query, { isActive: true });
  return mockAlerts;
};

UserState.findOne = async (query) => {
  return mockUsers[query.lineUserId] || null;
};

// Axios HTTP 요청 Mocking 및 파라미터 수집
const capturedParams = [];
axios.get = async (url, config) => {
  if (url === "https://serpapi.com/search.json") {
    capturedParams.push(config.params);
    // Mock SerpApi Response
    return {
      data: {
        best_flights: [
          {
            price: config.params.type === 1 ? 250000 : 120000,
            flights: [
              {
                departure_airport: { time: "2026-07-20 10:00" },
                airline: "Korean Air"
              }
            ]
          }
        ],
        other_flights: [],
        search_metadata: {
          google_flights_url: "https://google.com/flights/test"
        }
      }
    };
  }
  throw new Error(`Unexpected GET request to ${url}`);
};

axios.post = async (url, data, config) => {
  // Line push message mock
  return { data: { success: true } };
};

// Vercel Cron Handler 불러오기
import handler from "../api/cron.js";

test("Vercel Cron Handler - 왕복 항공권 시 return_date 파라미터가 포함되는지 검증", async () => {
  const req = {
    headers: {
      authorization: "Bearer test_cron_secret"
    },
    query: {}
  };

  let statusResult = null;
  let jsonResult = null;

  const res = {
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => {
          jsonResult = data;
        },
        end: (msg) => {
          jsonResult = msg;
        }
      };
    }
  };

  await handler(req, res);

  // 1. 상태코드 및 응답 확인
  assert.strictEqual(statusResult, 200);
  assert.strictEqual(jsonResult.success, true);

  // 2. SerpApi로 전송된 파라미터 검증
  assert.strictEqual(capturedParams.length, 2);

  // 첫 번째 요청: 왕복 (flight_type === 1)
  const roundTripParams = capturedParams[0];
  assert.strictEqual(roundTripParams.departure_id, "ICN");
  assert.strictEqual(roundTripParams.arrival_id, "NRT");
  assert.strictEqual(roundTripParams.outbound_date, "2026-07-20");
  assert.strictEqual(roundTripParams.return_date, "2026-07-27"); // 검증 대상!
  assert.strictEqual(roundTripParams.type, 1);

  // 두 번째 요청: 편도 (flight_type === 2)
  const oneWayParams = capturedParams[1];
  assert.strictEqual(oneWayParams.departure_id, "ICN");
  assert.strictEqual(oneWayParams.arrival_id, "NRT");
  assert.strictEqual(oneWayParams.outbound_date, "2026-07-20");
  assert.strictEqual(oneWayParams.return_date, undefined); // 편도에는 return_date가 없어야 함
  assert.strictEqual(oneWayParams.type, 2);

  console.log("🎉 모든 검증 테스트 케이스가 성공적으로 통과되었습니다!");
});
