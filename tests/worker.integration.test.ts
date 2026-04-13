import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "../src/worker.js";

const ACCEPT_HEADER = "application/json, text/event-stream";
const PROTOCOL_VERSION = "2025-03-26";

describe("worker MCP integration", () => {
  const originalFetch = globalThis.fetch;
  const upstreamFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    upstreamFetch.mockReset();
    globalThis.fetch = upstreamFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("supports initialize and tools/list", async () => {
    const initializeResponse = await mcpRequest({
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" }
      }
    });

    expect(initializeResponse.status).toBe(200);
    const initializeJson = (await initializeResponse.json()) as Record<string, any>;
    expect(initializeJson.result.protocolVersion).toBe(PROTOCOL_VERSION);

    const toolsResponse = await mcpRequest(
      {
        id: 2,
        method: "tools/list",
        params: {}
      },
      {
        protocolVersion: PROTOCOL_VERSION
      }
    );

    const toolsJson = (await toolsResponse.json()) as Record<string, any>;
    const tools = toolsJson.result.tools as Array<Record<string, unknown>>;

    expect(tools.some((tool) => tool.name === "raindrop_user_get_me")).toBe(true);

    const emptyTrash = tools.find(
      (tool) => tool.name === "raindrop_collections_empty_trash"
    );
    expect(emptyTrash?.annotations).toMatchObject({
      destructiveHint: true,
      openWorldHint: true
    });
  });

  it("returns 401 when the bearer token is missing", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          Accept: ACCEPT_HEADER,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "vitest", version: "1.0.0" }
          }
        })
      }),
      {}
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "unauthorized",
      result: false
    });
  });

  it("calls a read tool and forwards the bearer token upstream", async () => {
    upstreamFetch.mockResolvedValue(
      new Response(JSON.stringify({ result: true, user: { _id: 32, fullName: "Rustem" } }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const response = await mcpRequest(
      {
        id: 3,
        method: "tools/call",
        params: {
          name: "raindrop_user_get_me",
          arguments: {}
        }
      },
      {
        protocolVersion: PROTOCOL_VERSION
      }
    );

    const payload = (await response.json()) as Record<string, any>;
    expect(payload.result.structuredContent).toEqual({
      result: true,
      user: { _id: 32, fullName: "Rustem" }
    });
    expect(payload.result.content[0].text).toContain("raindrop_user_get_me");

    const [upstreamUrl, init] = upstreamFetch.mock.calls[0];
    expect(String(upstreamUrl)).toBe("https://api.raindrop.io/rest/v1/user");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer live-token"
    });
  });

  it("surfaces upstream auth failures as MCP tool errors", async () => {
    upstreamFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "token_invalid",
          errorMessage: "Access token is invalid",
          result: false
        }),
        {
          headers: { "content-type": "application/json" },
          status: 401
        }
      )
    );

    const response = await mcpRequest(
      {
        id: 4,
        method: "tools/call",
        params: {
          name: "raindrop_user_get_me",
          arguments: {}
        }
      },
      {
        protocolVersion: PROTOCOL_VERSION
      }
    );

    const payload = (await response.json()) as Record<string, any>;
    expect(payload.result.isError).toBe(true);
    expect(payload.result.structuredContent.error).toMatchObject({
      error: "token_invalid",
      errorMessage: "Access token is invalid",
      status: 401
    });
  });

  it("passes pagination and search arguments through to the Raindrop API", async () => {
    upstreamFetch.mockResolvedValue(
      new Response(JSON.stringify({ result: true, items: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const response = await mcpRequest(
      {
        id: 5,
        method: "tools/call",
        params: {
          name: "raindrop_raindrops_list",
          arguments: {
            collectionId: 0,
            nested: true,
            page: 1,
            perpage: 20,
            search: "tag:api",
            sort: "-created"
          }
        }
      },
      {
        protocolVersion: PROTOCOL_VERSION
      }
    );

    expect(response.status).toBe(200);

    const [upstreamUrl] = upstreamFetch.mock.calls[0];
    const url = new URL(String(upstreamUrl));

    expect(url.pathname).toBe("/rest/v1/raindrops/0");
    expect(url.searchParams.get("nested")).toBe("true");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("perpage")).toBe("20");
    expect(url.searchParams.get("search")).toBe("tag:api");
    expect(url.searchParams.get("sort")).toBe("-created");
  });
});

async function mcpRequest(
  payload: Record<string, unknown>,
  options: { protocolVersion?: string } = {}
): Promise<Response> {
  const headers = new Headers({
    Accept: ACCEPT_HEADER,
    Authorization: "Bearer live-token",
    "Content-Type": "application/json"
  });

  if (options.protocolVersion) {
    headers.set("MCP-Protocol-Version", options.protocolVersion);
  }

  return worker.fetch(
    new Request("https://example.com/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...payload
      })
    }),
    {}
  );
}
