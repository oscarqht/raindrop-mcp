import { describe, expect, it } from "vitest";

import { extractBearerToken, unauthorizedResponse } from "../src/auth.js";

describe("extractBearerToken", () => {
  it("returns the bearer token value", () => {
    expect(extractBearerToken("Bearer secret-token")).toBe("secret-token");
  });

  it("rejects a missing authorization header", () => {
    expect(() => extractBearerToken(null)).toThrow("Missing Authorization header");
  });

  it("rejects non-bearer authorization schemes", () => {
    expect(() => extractBearerToken("Basic abc123")).toThrow(
      "Authorization header must use Bearer token authentication"
    );
  });
});

describe("unauthorizedResponse", () => {
  it("returns a 401 JSON response", async () => {
    const response = unauthorizedResponse("Missing Authorization header");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      errorMessage: "Missing Authorization header",
      result: false
    });
  });
});
