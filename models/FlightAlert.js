import mongoose from "mongoose";

const FlightAlertSchema = new mongoose.Schema({
  lineUserId: { type: String, required: true },
  departure_id: { type: String, required: true },
  arrival_id: { type: String, required: true },
  outbound_date: { type: String, required: true },
  target_price: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const FlightAlert = mongoose.models.FlightAlert || mongoose.model("FlightAlert", FlightAlertSchema);
