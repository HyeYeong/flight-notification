import mongoose from "mongoose";

const UserStateSchema = new mongoose.Schema({
  lineUserId: { type: String, required: true, unique: true },
  step: { type: Number, default: 0 },
  language: { type: String, default: "ko" },
  currency: { type: String, default: "KRW" },
  // step 0: idle
  // step 1: waiting for departure (e.g. ICN)
  // step 2: waiting for arrival (e.g. NRT)
  // step 3: waiting for outbound date (YYYY-MM-DD)
  // step 4: waiting for target price (e.g. 300000)
  // step 10: waiting to select alert deletion index
  tempData: {
    departure_id: String,
    arrival_id: String,
    outbound_date: String,
    target_price: Number
  }
}, { timestamps: true });

export const UserState = mongoose.models.UserState || mongoose.model("UserState", UserStateSchema);
