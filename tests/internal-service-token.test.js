import { describe, expect, it } from "@jest/globals";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { createInternalServiceAuthorizationHeader } from "../src/services/internalServiceToken.js";

describe("internalServiceToken", () => {
  it("creates a bearer service token signed with shared secret", () => {
    const header = createInternalServiceAuthorizationHeader();
    expect(header.startsWith("Bearer ")).toBe(true);

    const token = header.substring("Bearer ".length);
    const claims = jwt.verify(token, env.jwtSecret, {
      issuer: env.jwtIssuer,
    });

    expect(claims.typ).toBe("service");
    expect(claims.sub).toBe(env.internalServiceId);
  });
});
