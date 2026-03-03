import "dotenv/config";

async function checkFlight() {
  console.log("✈️ Flight check script is running...");
  console.log("Current time:", new Date().toISOString());
}

checkFlight();
