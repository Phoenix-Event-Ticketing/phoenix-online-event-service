import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { router as eventRouter } from "./routes/event.routes.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { eventServiceOpenApi } from "./docs/openapi.event-service.js";
import { apiError } from "./utils/apiError.js";
import { metricsHandler, metricsMiddleware } from "./observability/metrics.js";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    const docs = req.path.startsWith("/events/docs");
    (docs ? helmet({ contentSecurityPolicy: false }) : helmet())(req, res, next);
  });
  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware);

  app.use((req, res, next) => {
    if (!req.headers["x-request-id"]) {
      req.headers["x-request-id"] = `req_${Date.now()}`;
    }
    if (!req.headers["x-trace-id"]) {
      req.headers["x-trace-id"] = req.headers.traceparent || `trace_${Date.now()}`;
    }
    res.setHeader("X-Request-Id", req.headers["x-request-id"]);
    res.setHeader("X-Trace-Id", req.headers["x-trace-id"]);
    next();
  });

  app.use(
    "/events/docs",
    swaggerUi.serve,
    swaggerUi.setup(eventServiceOpenApi, {
      defaultModelsExpandDepth: -1,
    }),
  );
  app.use("/events", eventRouter);

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: env.serviceName });
  });
  if (env.metricsEnabled) {
    app.get("/metrics", metricsHandler);
  }

  app.use((err, req, res, next) => {
    logger.error({ err, message: "Unhandled error" });
    apiError(res, 500, "Internal server error", "INTERNAL_ERROR", req);
  });

  return app;
}
