import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function createInternalServiceAuthorizationHeader() {
  const ttlSeconds = Number.isFinite(env.internalServiceTokenTtlSeconds)
    ? Math.max(env.internalServiceTokenTtlSeconds, 60)
    : 300;

  const token = jwt.sign(
    {
      sub: env.internalServiceId || env.serviceName || "event-service",
      typ: "service",
    },
    env.jwtSecret,
    {
      algorithm: "HS256",
      issuer: env.jwtIssuer || "phoenix-online-auth",
      expiresIn: ttlSeconds,
    },
  );

  return `Bearer ${token}`;
}
