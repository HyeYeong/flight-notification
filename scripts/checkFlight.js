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

    const params = {
      engine: "google_flights",
      departure_id: alert.departure_id,
      arrival_id: alert.arrival_id,
      outbound_date: alert.outbound_date,
      type: 1, 
      currency: currency,
      hl: lang,
      api_key: apiKey
    };

    try {
      console.log(`\n🔍 Searching: ${params.departure_id}->${params.arrival_id} (${params.outbound_date}) for USER ${alert.lineUserId.substring(0,6)}... [Lang: ${lang}, Curr: ${currency}]`);
      const response = await axios.get("https://serpapi.com/search.json", { params });

      const bestFlights = response.data.best_flights || [];
      const otherFlights = response.data.other_flights || [];
      let allFlights = [...bestFlights, ...otherFlights];

      allFlights = allFlights.filter(f => f.price !== undefined && f.price !== null);

      if (allFlights.length === 0) {
        console.log(`🤔 [${alert.departure_id}->${alert.arrival_id}] No flight data found.`);
        continue;
      }

      allFlights.sort((a, b) => a.price - b.price);
      const topFlights = allFlights.slice(0, 4);
      const bookingUrl = response.data.search_metadata.google_flights_url;
      const cheapestPrice = topFlights[0].price;

      console.log(`✅ Cheapest for this route: ${cheapestPrice.toLocaleString()} ${currency} (Target: ${alert.target_price.toLocaleString()} ${currency})`);

      if (cheapestPrice <= alert.target_price) {
        // 목표가 달성!
        console.log(`🚨 Target price reached! Sending LINE message to ${alert.lineUserId}...`);
        
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const enableLineMessage = process.env.ENABLE_LINE_MESSAGE === "true";

        if (!enableLineMessage) {
          console.log("ℹ️ LINE messages are disabled in this environment (ENABLE_LINE_MESSAGE=false).");
          continue;
        }

        if (!lineToken) {
          console.error("❌ LINE_CHANNEL_ACCESS_TOKEN is missing.");
          continue;
        }

        const flightsInfoText = topFlights.map((flight, index) => {
          const airlines = flight.flights.map(f => f.airline).join(", ");
          const departureTime = flight.flights[0].departure_airport.time;
          return `${index + 1}. ${airlines} (${departureTime}) : ${flight.price.toLocaleString()} ${currency}`;
        }).join("\n");

        const messageText = t(lang, 'flight_alert_found', {
          dep: params.departure_id,
          arr: params.arrival_id,
          date: params.outbound_date,
          flights: flightsInfoText,
          url: bookingUrl
        });

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
