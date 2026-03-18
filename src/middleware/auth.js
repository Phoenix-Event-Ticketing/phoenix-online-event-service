import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { logHttp } from "../utils/logger.js";

export function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    logHttp({
      level: "warn",
      req,
      res,
      operation: "auth_authenticate",
      message: "Missing or invalid Authorization header",
      metadata: { hasAuthorizationHeader: Boolean(authHeader) },
    });
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    logHttp({
      level: "warn",
      req,
      res,
      operation: "auth_authenticate",
      message: "Invalid or expired token",
      metadata: { error: err.message },
    });
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function authorize(requiredPermissions = []) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.permissions)) {
      logHttp({
        level: "warn",
        req,
        res,
        operation: "auth_authorize",
        message: "Forbidden: missing user permissions",
        metadata: { requiredPermissions },
      });
      return res.status(403).json({ message: "Forbidden" });
    }

    const hasAll = requiredPermissions.every((perm) =>
      req.user.permissions.includes(perm),
    );

    if (!hasAll) {
      logHttp({
        level: "warn",
        req,
        res,
        operation: "auth_authorize",
        message: "Forbidden: insufficient permissions",
        metadata: {
          requiredPermissions,
          userPermissionsCount: req.user.permissions.length,
        },
      });
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}
