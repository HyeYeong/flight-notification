import mongoose from "mongoose";

const UserStateSchema = new mongoose.Schema({
  lineUserId: { type: String, required: true, unique: true },
  step: { type: Number, default: 0 },
  language: { type: String, default: "ko" },
  currency: { type: String, default: "KRW" },
  isAdmin: { type: Boolean, default: false },
  // step 0: idle
  // step 1: waiting for departure (e.g. ICN)
  // step 2: waiting for arrival (e.g. NRT)
  // step 3: waiting for flight type (round/oneway)
  // step 4: waiting for outbound date (YYYY-MM-DD)
  // step 5: waiting for return date (round-trip only)
  // step 6: waiting for target price
  // step 100: waiting for language selection
  // step 200: waiting for alert deletion index
  tempData: {
    departure_id: String,
    arrival_id: String,
    flight_type: Number,
    outbound_date: String,
    return_date: String,
    target_price: Number
  }
}, { timestamps: true });

export const UserState = mongoose.models.UserState || mongoose.model("UserState", UserStateSchema);
