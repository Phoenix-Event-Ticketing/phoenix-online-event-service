import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { router as eventRouter } from "./routes/event.routes.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { eventServiceOpenApi } from "./docs/openapi.event-service.js";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    const docs = req.path.startsWith("/api/v1/events/docs");
    (docs ? helmet({ contentSecurityPolicy: false }) : helmet())(req, res, next);
  });
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    if (!req.headers["x-request-id"]) {
      req.headers["x-request-id"] = `req_${Date.now()}`;
    }
    next();
  });

  app.use(
    "/api/v1/events/docs",
    swaggerUi.serve,
    swaggerUi.setup(eventServiceOpenApi, {
      defaultModelsExpandDepth: -1,
    }),
  );
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
