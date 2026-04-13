import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { extractBearerToken, unauthorizedResponse } from "./auth.js";
import {
  createRaindropMcpServer,
  DEFAULT_RAINDROP_API_BASE
} from "./mcp-server.js";

interface Env {
  RAINDROP_API_BASE?: string;
}

const MCP_PATH = "/mcp";
const HEALTH_PATH = "/healthz";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === HEALTH_PATH) {
      return Response.json({
        ok: true,
        service: "raindrop-mcp"
      });
    }

    if (url.pathname !== MCP_PATH) {
      return Response.json(
        {
          error: "not_found",
          errorMessage: "Route not found",
          result: false
        },
        { status: 404 }
      );
    }

    let token: string;

    try {
      token = extractBearerToken(request.headers.get("authorization"));
    } catch (error) {
      return unauthorizedResponse(
        error instanceof Error ? error.message : "Unauthorized"
      );
    }

    const server = createRaindropMcpServer({
      apiBase: env.RAINDROP_API_BASE ?? DEFAULT_RAINDROP_API_BASE,
      token
    });

    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true
    });

    await server.connect(transport);

    try {
      const response = await transport.handleRequest(request);

      if (request.method !== "GET") {
        await server.close();
      }

      return response;
    } catch (error) {
      await server.close();

      return Response.json(
        {
          error: "internal_error",
          errorMessage:
            error instanceof Error ? error.message : "Unexpected error",
          result: false
        },
        { status: 500 }
      );
    }
  }
};
