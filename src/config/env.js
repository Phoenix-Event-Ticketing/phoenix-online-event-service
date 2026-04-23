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
  metricsEnabled: String(process.env.METRICS_ENABLED || "true").toLowerCase() === "true",
  jaegerEndpoint: process.env.JAEGER_ENDPOINT || "",
  otelServiceName: process.env.OTEL_SERVICE_NAME || "event-service",
  jwtSecret: (process.env.JWT_SECRET || "dev-jwt-secret-change-in-prod").trim(),
  jwtIssuer: process.env.JWT_ISSUER || "phoenix-online-auth",
  internalServiceId: process.env.INTERNAL_SERVICE_ID || "event-service",
  internalServiceTokenTtlSeconds: Number.parseInt(
    process.env.INTERNAL_SERVICE_TOKEN_TTL_SECONDS || "300",
    10,
  ),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};
