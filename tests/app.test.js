import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

await jest.unstable_mockModule("../src/routes/event.routes.js", () => ({
  router: express.Router().get("/boom", (req, res, next) => {
    next(new Error("boom"));
  }),
}));

await jest.unstable_mockModule("../src/config/env.js", () => ({
  env: { serviceName: "event-service" },
}));

const mockLoggerError = jest.fn();
await jest.unstable_mockModule("../src/utils/logger.js", () => ({
  logger: { error: mockLoggerError },
}));

await jest.unstable_mockModule("../src/docs/openapi.event-service.js", () => ({
  eventServiceOpenApi: { openapi: "3.0.3", info: { title: "t", version: "1" }, paths: {} },
}));

await jest.unstable_mockModule("swagger-ui-express", () => ({
  default: {
    serve: (req, res, next) => next(),
    setup: () => (req, res) => res.status(200).json({ docs: true }),
  },
}));

const { createApp } = await import("../src/app.js");

describe("createApp", () => {
  it("returns health and forwards errors to the global handler", async () => {
    const app = createApp();
    const health = await request(app).get("/health").expect(200);
    expect(health.body).toEqual({ status: "ok", service: "event-service" });

    const errRes = await request(app).get("/api/v1/events/boom").expect(500);
    expect(errRes.body).toEqual({ message: "Internal server error" });
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("serves swagger docs path", async () => {
    const app = createApp();
    const docs = await request(app).get("/api/v1/events/docs").expect(200);
    expect(docs.body).toEqual({ docs: true });
  });
});
