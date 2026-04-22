import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const eventLookupRequests = new client.Counter({
  name: "event_lookup_requests_total",
  help: "Event lookup requests by outcome.",
  labelNames: ["route", "outcome"],
  registers: [register],
});

export const eventHttpRequests = new client.Counter({
  name: "event_http_requests_total",
  help: "HTTP requests by method, route and status.",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export function metricsMiddleware(req, res, next) {
  res.on("finish", () => {
    eventHttpRequests.inc({
      method: req.method,
      route: req.route?.path || req.path || "unknown",
      status_code: String(res.statusCode),
    });
  });
  next();
}

export async function metricsHandler(req, res) {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
}
