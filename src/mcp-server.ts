import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { RaindropClient } from "./raindrop-client.js";
import { registerRaindropTools } from "./register-tools.js";

export const DEFAULT_RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";

const SERVER_INFO = {
  name: "raindrop-mcp",
  version: "1.0.0"
};

export interface CreateRaindropMcpServerOptions {
  apiBase?: string;
  fetchImpl?: typeof fetch;
  token: string;
}

export function createRaindropMcpServer(
  options: CreateRaindropMcpServerOptions
): McpServer {
  const client = new RaindropClient({
    apiBase: options.apiBase ?? DEFAULT_RAINDROP_API_BASE,
    fetchImpl: options.fetchImpl,
    token: options.token
  });

  const server = new McpServer(SERVER_INFO, {
    instructions:
      "Send Authorization: Bearer <raindrop-api-token> on every /mcp request. This server forwards the token directly to Raindrop.io REST API calls."
  });

  registerRaindropTools(server, client);

  return server;
}
