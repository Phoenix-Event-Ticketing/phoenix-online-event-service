import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

export const env = {
  port: process.env.PORT || 4001,
  mongoUri: process.env.MONGO_URI,
  nodeEnv: process.env.NODE_ENV || "development",
  serviceName: process.env.SERVICE_NAME || "event-service",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-prod",
};
