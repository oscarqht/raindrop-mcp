import { beforeEach, describe, expect, it, vi } from "vitest";

import { RaindropApiError, RaindropClient } from "../src/raindrop-client.js";

describe("RaindropClient", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: RaindropClient;

  beforeEach(() => {
    fetchMock.mockReset();
    client = new RaindropClient({
      apiBase: "https://api.raindrop.io/rest/v1",
      fetchImpl: fetchMock,
      token: "test-token"
    });
  });

  it("builds JSON requests with bearer auth, query params, and body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ result: true, user: { _id: 1 } }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const result = await client.requestJson("POST", "/user", {
      query: { search: "hello", page: 2 },
      body: { fullName: "Example User" }
    });

    expect(result).toEqual({ result: true, user: { _id: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(url));

    expect(requestUrl.pathname).toBe("/rest/v1/user");
    expect(requestUrl.searchParams.get("search")).toBe("hello");
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    });
    expect(init?.body).toBe(JSON.stringify({ fullName: "Example User" }));
  });

  it("normalizes API errors with status and rate-limit metadata", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "token_invalid",
          errorMessage: "Access token is invalid",
          result: false
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-ratelimit-limit": "120",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1710000000"
          },
          status: 401
        }
      )
    );

    await expect(client.requestJson("GET", "/user")).rejects.toMatchObject({
      error: "token_invalid",
      errorMessage: "Access token is invalid",
      rateLimit: {
        limit: 120,
        remaining: 0,
        reset: 1710000000
      },
      status: 401
    });
  });
});
