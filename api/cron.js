import axios from "axios";
import { connectDB } from "../models/db.js";
import { FlightAlert } from "../models/FlightAlert.js";
import { UserState } from "../models/UserState.js";
import { t, getFlightTypeBracket } from "../utils/messages.js";

// 날짜/시간 파싱 헬퍼 함수
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

// 시간 범위 필터 함수
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

export default async function handler(req, res) {
  // 인증 체크: 외부인이 API를 마음대로 호출해서 비용을 깎아먹지 못하게 Secret 보호
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end("Unauthorized");
  }

  // 관리자가 search now로 호출한 경우, 결과를 알려줄 LINE user ID
  const reportTo = req.query.reportTo || null;

  console.log("✈️ Vercel Cron API is running...");
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.error("❌ SERP_API_KEY is missing");
    return res.status(500).end("API Key Missing");
  }

  await connectDB();
  const activeAlerts = await FlightAlert.find({ isActive: true });
  console.log(`📌 Found ${activeAlerts.length} active flight alerts.`);

  // 관리자 리포트용 결과 누적
  const reportLines = [];

  // 유저별 라인 메시지 누적
  const userMessages = {};

  for (const alert of activeAlerts) {
    const user = await UserState.findOne({ lineUserId: alert.lineUserId });
    const lang = (user && user.language) ? user.language : "ko";
    const currency = (user && user.currency) ? user.currency : "KRW";

    const outParsed = parseDateInput(alert.outbound_date);
    const retParsed = alert.flight_type === 1 ? parseDateInput(alert.return_date) : null;

    if (alert.flight_type === 1 && (!retParsed || !retParsed.date)) {
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
      stops: "1", // 직항만
      api_key: apiKey
    };

    try {
      const response = await axios.get("https://serpapi.com/search.json", { params });
      let allFlights = [...(response.data.best_flights || []), ...(response.data.other_flights || [])];
      allFlights = allFlights.filter(f => f.price !== undefined && f.price !== null);

      allFlights = allFlights.filter(f => {
        if (!f.flights || f.flights.length === 0) return false;
        const outTime = f.flights[0].departure_airport.time;
        if (!isWithinTimeRange(outTime, outParsed)) return false;
        return true;
      });

      const nowTime = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
      const enableLineMessage = process.env.ENABLE_LINE_MESSAGE === "true";
      const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

      if (allFlights.length === 0) {
        reportLines.push(`⚠️ [${alert.departure_id}→${alert.arrival_id}] 검색 결과 없음 (시간 조건 초과)`);
        if (enableLineMessage && lineToken) {
          const notFoundMsg = t(lang, 'flight_alert_not_found', { time: nowTime, dep: alert.departure_id, arr: alert.arrival_id, date: alert.outbound_date });
          userMessages[alert.lineUserId] = userMessages[alert.lineUserId] || [];
          userMessages[alert.lineUserId].push({ type: "text", text: notFoundMsg });
        }
        continue;
      }

      allFlights.sort((a, b) => a.price - b.price);
      const topFlights = allFlights.slice(0, 5);
      const bookingUrl = response.data.search_metadata.google_flights_url;
      const cheapestPrice = topFlights[0].price;

      if (cheapestPrice <= alert.target_price) {
        console.log(`🚨 Target price reached for ${alert.lineUserId}`);
        reportLines.push(`✅ [${alert.departure_id}→${alert.arrival_id}] 목표가 달성! 최저 ${cheapestPrice.toLocaleString()} ${currency}`);
      } else {
        reportLines.push(`🔍 [${alert.departure_id}→${alert.arrival_id}] 현재 최저 ${cheapestPrice.toLocaleString()} ${currency} (목표: ${alert.target_price.toLocaleString()} ${currency} 이하)`);
      }

      if (cheapestPrice <= alert.target_price) {
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

        const typeStr = getFlightTypeBracket(alert.flight_type, lang);
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

        if (enableLineMessage && lineToken) {
          userMessages[alert.lineUserId] = userMessages[alert.lineUserId] || [];
          userMessages[alert.lineUserId].push({ type: "text", text: messageText });
        }
      } else {
        if (enableLineMessage && lineToken) {
          const notMetMsg = t(lang, 'flight_alert_not_met', {
            time: nowTime,
            dep: alert.departure_id,
            arr: alert.arrival_id,
            targetPrice: alert.target_price.toLocaleString(),
            cheapestPrice: cheapestPrice.toLocaleString(),
            currency: currency,
            date: alert.outbound_date
          });
          userMessages[alert.lineUserId] = userMessages[alert.lineUserId] || [];
          userMessages[alert.lineUserId].push({ type: "text", text: notMetMsg });
        }
      }
    } catch (e) {
      console.error(`❌ Error fetching flights for ${alert._id}`, e.message);
      reportLines.push(`❌ [${alert.departure_id}→${alert.arrival_id}] 검색 오류: ${e.message}`);
    }
  }

  // 사용자들에게 누적된 메시지 일괄 발송 (API 리밋 및 데이터 유실 방지)
  const isEnabled = process.env.ENABLE_LINE_MESSAGE === "true";
  const globalLineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (isEnabled && globalLineToken) {
    for (const [userId, msgs] of Object.entries(userMessages)) {
      let currentText = "";
      let finalMessages = [];

      for (const msg of msgs) {
        if (currentText.length + msg.text.length + 20 > 4000) {
          finalMessages.push({ type: "text", text: currentText });
          currentText = msg.text;
        } else {
          if (currentText.length > 0) {
            currentText += "\n\n────────────────\n\n";
          }
          currentText += msg.text;
        }
      }
      if (currentText.length > 0) {
        finalMessages.push({ type: "text", text: currentText });
      }

      for (let i = 0; i < finalMessages.length; i += 5) {
        const chunk = finalMessages.slice(i, i + 5);
        await axios.post(
          "https://api.line.me/v2/bot/message/push",
          { to: userId, messages: chunk },
          { headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalLineToken}` } }
        ).catch(e => console.error(`Error sending batch to ${userId}:`, e.message));
      }
    }
  }

  // 관리자에게 검색 결과 요약 발송
  if (reportTo) {
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken) {
      const summary = reportLines.length > 0
        ? `📊 검색 완료 결과:\n\n${reportLines.join('\n')}`
        : '📭 등록된 활성 알림이 없습니다.';
      await axios.post(
        "https://api.line.me/v2/bot/message/push",
        { to: reportTo, messages: [{ type: "text", text: summary }] },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` } }
      ).catch(e => console.error('Admin report error:', e.message));
    }
  }

  return res.status(200).json({ success: true, message: "Flight check completed.", results: reportLines });
}
