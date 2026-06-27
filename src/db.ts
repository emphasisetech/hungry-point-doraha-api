import mongoose from "mongoose";
import { config } from "./config";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(config.mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const usesSrv = config.mongoUri.startsWith("mongodb+srv://");
    const safeUri = config.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//<user>:<password>@");

    console.error("MongoDB connection failed.");
    console.error(`URI: ${safeUri}`);
    if (usesSrv && /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/i.test(message)) {
      console.error(
        [
          "This looks like a MongoDB Atlas SRV/DNS issue.",
          "Check that your Atlas URI host is correct, for example:",
          "mongodb+srv://<user>:<password>@<cluster-name>.<cluster-id>.mongodb.net/hungry-point-doraha",
          "If DNS blocks SRV records on this network, use a local MongoDB URI instead:",
          "mongodb://127.0.0.1:27017/hungry-point-doraha"
        ].join("\n")
      );
    }
    throw error;
  }
}
