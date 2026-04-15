import dotenv from "dotenv";
import axios from "axios";

// 환경에 따라 다른 env 파일 로드
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: envFile });
console.log(`🔧 Loading environment from: ${envFile}`);

import { connectDB } from "../models/db.js";
import { FlightAlert } from "../models/FlightAlert.js";
import { UserState } from "../models/UserState.js";
import { t } from "../utils/messages.js";

function parseDateInput(input) {
  if (!input) return { date: null };
  const parts = input.trim().split(/\s+/);
  const dateObj = { date: parts[0] };
  if (parts.length > 1) {
    const timePart = parts[1];
    if (timePart.includes("-")) {
      const [startStr, endStr] = timePart.split("-");
      if (startStr) {
        const [h, m] = startStr.split(":");
        dateObj.startHour = parseInt(h, 10);
        dateObj.startMin = m ? parseInt(m, 10) : 0;
      }
      if (endStr) {
        const [h, m] = endStr.split(":");
        dateObj.endHour = parseInt(h, 10);
        dateObj.endMin = m ? parseInt(m, 10) : 0;
      }
    }
  }
  return dateObj;
}

function isWithinTimeRange(flightTimeStr, parsedRange) {
  if (parsedRange.startHour == null && parsedRange.endHour == null) return true;
  const timeRegex = /\s(\d{1,2}):(\d{2})/;
  const match = flightTimeStr.match(timeRegex);
  if (!match) return true;

  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const totalMins = h * 60 + m;

  if (parsedRange.startHour != null && !isNaN(parsedRange.startHour)) {
    const startMins = parsedRange.startHour * 60 + (parsedRange.startMin || 0);
    if (totalMins < startMins) return false;
  }

  if (parsedRange.endHour != null && !isNaN(parsedRange.endHour)) {
    const endMins = parsedRange.endHour * 60 + (parsedRange.endMin || 0);
    if (totalMins > endMins) return false;
  }
  return true;
}

async function checkFlight() {
  console.log("✈️ Flight check script is running...");
  console.log("Current time:", new Date().toISOString());

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.error("❌ SERP_API_KEY is missing in .env file (or not set)");
    return;
  }

  await connectDB();
  const activeAlerts = await FlightAlert.find({ isActive: true });
  console.log(`📌 Found ${activeAlerts.length} active flight alerts in DB.`);

  for (const alert of activeAlerts) {
    const user = await UserState.findOne({ lineUserId: alert.lineUserId });
    const lang = (user && user.language) ? user.language : "ko";
    const currency = (user && user.currency) ? user.currency : "KRW";

    const outParsed = parseDateInput(alert.outbound_date);
    const retParsed = alert.flight_type === 1 ? parseDateInput(alert.return_date) : null;

    if (alert.flight_type === 1 && (!retParsed || !retParsed.date)) {
      console.log(`⚠️ Skipping invalid alert ${alert._id} (Round-trip but missing return date). Saves API calls!`);
      continue;
    }

    const params = {
      engine: "google_flights",
      departure_id: alert.departure_id,
      arrival_id: alert.arrival_id,
      outbound_date: outParsed.date,
      type: alert.flight_type || 1,
      currency: currency,
      hl: lang,
      stops: "1", // 직항만 (Nonstop only)
      api_key: apiKey
    };

    if (alert.flight_type === 1 && retParsed && retParsed.date) {
      params.return_date = retParsed.date;
    }

    try {
      console.log(`\n🔍 Searching: ${params.departure_id}->${params.arrival_id} (${params.outbound_date}) for USER ${alert.lineUserId.substring(0, 6)}... [Lang: ${lang}, Curr: ${currency}]`);
      const response = await axios.get("https://serpapi.com/search.json", { params });

      const bestFlights = response.data.best_flights || [];
      const otherFlights = response.data.other_flights || [];
      let allFlights = [...bestFlights, ...otherFlights];

      allFlights = allFlights.filter(f => f.price !== undefined && f.price !== null);

      // 시간 필터링
      allFlights = allFlights.filter(f => {
        if (!f.flights || f.flights.length === 0) return false;
        const outTime = f.flights[0].departure_airport.time;
        if (!isWithinTimeRange(outTime, outParsed)) return false;

        if (alert.flight_type === 1 && retParsed) {
          // 참고: 구글 플라이트 API(SerpApi) 첫번째 응답에는 '가는 편(들)'의 정보만 담겨옴
          // 오는 편의 세부 날짜 검증은 2차 API 호출이 필요하여, 로컬에서는 가는 편 일치만 확인함
        }
        return true;
      });

      if (allFlights.length === 0) {
        console.log(`🤔 [${alert.departure_id}->${alert.arrival_id}] No matching flight data found within time range.`);
        continue;
      }

      allFlights.sort((a, b) => a.price - b.price);
      const topFlights = allFlights.slice(0, 5); // rank 1에서 5위까지 표시
      const bookingUrl = response.data.search_metadata.google_flights_url;
      const cheapestPrice = topFlights[0].price;

      console.log(`✅ Cheapest for this route: ${cheapestPrice.toLocaleString()} ${currency} (Target: ${alert.target_price.toLocaleString()} ${currency})`);

      if (cheapestPrice <= alert.target_price) {
        // 목표가 달성!
        console.log(`🚨 Target price reached! Sending LINE message to ${alert.lineUserId}...`);

        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const enableLineMessage = process.env.ENABLE_LINE_MESSAGE === "true";

        const flightsInfoText = topFlights.map((flight, index) => {
          let flightStr = `${index + 1}. 💰 ${flight.price.toLocaleString()} ${currency}\n`;
          let outTime = flight.flights[0].departure_airport.time;
          let outAirline = flight.flights[0].airline;

          if (flight.flights.length > 1) {
            flightStr += `   🛫 ${outTime} (${outAirline}) 외 ${flight.flights.length - 1}회 경유`;
          } else {
            flightStr += `   🛫 ${outTime} (${outAirline})`;
          }
          return flightStr;
        }).join("\n\n");

        const typeStr = alert.flight_type === 1 ? (lang === 'ko' ? '[왕복]' : '[往復]') : (lang === 'ko' ? '[편도]' : '[片道]');
        const returnStr = alert.flight_type === 1 ? (lang === 'ko' ? `오는날: ${alert.return_date}` : `到着日: ${alert.return_date}`) : '';

        const messageText = t(lang, 'flight_alert_found', {
          typeStr,
          dep: params.departure_id,
          arr: params.arrival_id,
          date: alert.outbound_date,
          returnStr: returnStr,
          flights: flightsInfoText,
          url: bookingUrl
        });

        console.log(`\n========== 푸시 알림 내용 미리보기 ==========`);
        console.log(messageText);
        console.log(`=============================================\n`);

        if (!enableLineMessage) {
          console.log("ℹ️ LINE messages are disabled in this environment (ENABLE_LINE_MESSAGE=false).");
          continue;
        }

        if (!lineToken) {
          console.error("❌ LINE_CHANNEL_ACCESS_TOKEN is missing.");
          continue;
        }

        try {
          await axios.post(
            "https://api.line.me/v2/bot/message/push",
            {
              to: alert.lineUserId,
              messages: [{ type: "text", text: messageText }]
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lineToken}`
              }
            }
          );
          console.log("✅ LINE message sent successfully!");
        } catch (lineError) {
          console.error("❌ Error sending LINE message:", lineError.response ? lineError.response.data : lineError.message);
        }
      } else {
        console.log(`⏰ Price is still higher than target.`);
      }
    } catch (error) {
      console.error(`❌ Error fetching flight data for alert ${alert._id}:`, error.message);
    }
  }

  process.exit(0);
}

checkFlight();
