import express from "express";
import cors from "cors";
import helmet from "helmet";
import { router as eventRouter } from "./routes/event.routes.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    if (!req.headers["x-request-id"]) {
      req.headers["x-request-id"] = `req_${Date.now()}`;
    }
    next();
  });

  app.use("/api/v1/events", eventRouter);

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: env.serviceName });
  });

  app.use((err, req, res, next) => {
    logger.error({ err, message: "Unhandled error" });
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

