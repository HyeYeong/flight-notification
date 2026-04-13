import dotenv from "dotenv";
import axios from "axios";

// 환경에 따라 다른 env 파일 로드
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: envFile });
console.log(`🔧 Loading environment from: ${envFile}`);

async function checkFlight() {
  console.log("✈️ Flight check script is running...");
  console.log("Current time:", new Date().toISOString());

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.error("❌ SERP_API_KEY is missing in .env file (or not set)");
    return;
  }

  const params = {
    engine: "google_flights",
    departure_id: process.env.DEPARTURE_ID || "ICN",
    arrival_id: process.env.ARRIVAL_ID || "NRT",
    outbound_date: process.env.OUTBOUND_DATE || "2026-06-01",
    return_date: process.env.RETURN_DATE || "2026-06-05",
    type: process.env.FLIGHT_TYPE || 1, // 1: 왕복 2:편도
    currency: "KRW",
    hl: "ko",
    api_key: apiKey
  };

  try {
    console.log(`🔍 Searching flights from ${params.departure_id} to ${params.arrival_id}...`);
    const response = await axios.get("https://serpapi.com/search.json", { params });

    // Google Flights results usually contain 'best_flights' or 'other_flights'
    const bestFlights = response.data.best_flights || [];
    const otherFlights = response.data.other_flights || [];
    let allFlights = [...bestFlights, ...otherFlights];

    // 일부 항공편 데이터 중 가격(price)이 누락된 항목이 있을 수 있으므로 필터링
    allFlights = allFlights.filter(f => f.price !== undefined && f.price !== null);

    if (allFlights.length === 0) {
      console.log("🤔 No flight data found. Returning...");
      return;
    }

    // 최저가 순 정렬
    allFlights.sort((a, b) => a.price - b.price);

    // 상위 4개 추출
    const topFlights = allFlights.slice(0, 4);
    const bookingUrl = response.data.search_metadata.google_flights_url;

    console.log(`\n✅ 최저가 추천 TOP ${topFlights.length}:`);
    topFlights.forEach((flight, index) => {
      const airlines = flight.flights.map(f => f.airline).join(", ");
      const departureTime = flight.flights[0].departure_airport.time;
      console.log(`${index + 1}. [${airlines}] 🕒 ${departureTime} - 💰 ${flight.price.toLocaleString()} KRW`);
    });

    const cheapestPrice = topFlights[0].price;
    const maxPrice = Number(process.env.MAX_PRICE) || 300000;
    
    if (cheapestPrice <= maxPrice) {
      console.log(`\n🚨 Target price (${maxPrice.toLocaleString()} KRW) reached or lower!`);

      // LINE API Call
      const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      const lineUserId = process.env.LINE_USER_ID;
      const enableLineMessage = process.env.ENABLE_LINE_MESSAGE === "true";

      if (!enableLineMessage) {
        console.log("ℹ️ LINE messages are disabled in this environment (ENABLE_LINE_MESSAGE=false).");
        return;
      }

      console.log("📲 Sending a LINE message...");
      if (!lineToken || !lineUserId) {
        console.error("❌ LINE_CHANNEL_ACCESS_TOKEN or LINE_USER_ID is missing in your env file.");
        return;
      }

      const flightsInfoText = topFlights.map((flight, index) => {
        const airlines = flight.flights.map(f => f.airline).join(", ");
        const departureTime = flight.flights[0].departure_airport.time;
        // 시간이 "2026-06-01 08:50" 형태이므로 시간만 잘라도 좋지만 본래 형태 유지
        return `${index + 1}. ${airlines} (${departureTime}) : ${flight.price.toLocaleString()}원`;
      }).join("\n");

      const messageText = `✈️ 목표가 달성 항공편 발견! ✈️\n\n여정: ${params.departure_id} -> ${params.arrival_id}\n날짜: ${params.outbound_date}\n\n[최저가 순 랭킹]\n${flightsInfoText}\n\n🔗 신뢰할 수 있는 예약처(구글 항공권 구경가기):\n${bookingUrl}`;

      try {
        await axios.post(
          "https://api.line.me/v2/bot/message/push",
          {
            to: lineUserId,
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
      console.log(`\n⏰ Price is still higher than target (${maxPrice.toLocaleString()} KRW). No message sent.`);
    }

  } catch (error) {
    console.error("❌ Error fetching flight data:", error.message);
  }
}

checkFlight();
