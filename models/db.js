import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "flight_alerts",
    });
    isConnected = db.connections[0].readyState;
    console.log("📦 MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};
