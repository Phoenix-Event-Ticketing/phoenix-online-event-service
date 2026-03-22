import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockLogHttp = jest.fn();

await jest.unstable_mockModule("../src/utils/logger.js", () => ({
  logHttp: mockLogHttp,
}));

await jest.unstable_mockModule("../src/config/env.js", () => ({
  env: { jwtSecret: "test-secret", serviceName: "event-service", nodeEnv: "test" },
}));

const { authenticate, authorize } = await import("../src/middleware/auth.js");

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects invalid JWT", () => {
    const req = { headers: { authorization: "Bearer not-a-token" } };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("authorizes when user has required permissions", () => {
    const mw = authorize(["VIEW_EVENTS"]);
    const req = { headers: {}, user: { permissions: ["VIEW_EVENTS"] } };
    const res = mockRes();
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when permissions are missing or insufficient", () => {
    const mw = authorize(["CREATE_EVENT"]);
    const req = { headers: {}, user: { permissions: ["VIEW_EVENTS"] } };
    const res = mockRes();
    const next = jest.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);

    const req2 = { headers: {}, user: {} };
    const res2 = mockRes();
    mw(req2, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(403);
  });
});
