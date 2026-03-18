import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: env.serviceName,
    environment: env.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function logHttp(options) {
  const { level = "info", req, res, operation, message, metadata = {} } = options;

  const logPayload = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: env.serviceName,
    environment: env.nodeEnv,
    request_id: req?.headers?.["x-request-id"],
    trace_id: req?.headers?.["x-trace-id"],
    user_id: req?.user?.sub,
    operation,
    message,
    metadata,
  };

  logger[level.toLowerCase()](logPayload);
}

