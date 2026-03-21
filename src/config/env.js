import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

export const env = {
  port: process.env.PORT || 4001,
  mongoUri: process.env.MONGO_URI,
  nodeEnv: process.env.NODE_ENV || "development",
  serviceName: process.env.SERVICE_NAME || "event-service",
  inventoryServiceUrl:
    process.env.INVENTORY_SERVICE_URL || "http://localhost:8080",
  jwtSecret: (process.env.JWT_SECRET || "dev-jwt-secret-change-in-prod").trim(),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};
