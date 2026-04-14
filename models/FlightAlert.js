import mongoose from "mongoose";

const FlightAlertSchema = new mongoose.Schema({
  lineUserId: { type: String, required: true },
  departure_id: { type: String, required: true },
  arrival_id: { type: String, required: true },
  flight_type: { type: Number, default: 1 }, // 1: round-trip, 2: one-way
  outbound_date: { type: String, required: true },
  return_date: { type: String }, // Optional for one-way
  target_price: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const FlightAlert = mongoose.models.FlightAlert || mongoose.model("FlightAlert", FlightAlertSchema);
