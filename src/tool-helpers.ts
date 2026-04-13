import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { RaindropApiError } from "./raindrop-client.js";

export const toolOutputSchema = z.object({}).passthrough();

interface RegisterToolConfig<TArgs> {
  annotations: ToolAnnotations;
  description: string;
  execute: (args: TArgs) => Promise<object>;
  inputSchema: z.ZodType<TArgs>;
  name: string;
  summarize?: (data: Record<string, unknown>, args: TArgs) => string;
}

export function defaultAnnotations(overrides: ToolAnnotations): ToolAnnotations {
  return {
    openWorldHint: true,
    ...overrides
  };
}

export function registerRaindropTool<TArgs>(
  server: McpServer,
  config: RegisterToolConfig<TArgs>
): void {
  server.registerTool(
    config.name,
    {
      description: config.description,
      inputSchema: config.inputSchema,
      outputSchema: toolOutputSchema,
      annotations: defaultAnnotations(config.annotations)
    },
    async (args) => {
      try {
        const data = (await config.execute(args as TArgs)) as Record<string, unknown>;
        const text = config.summarize?.(data, args as TArgs) ?? summarizePayload(config.name, data);

        return {
          content: [{ type: "text", text }],
          structuredContent: data
        } satisfies CallToolResult;
      } catch (error) {
        return toToolErrorResult(error);
      }
    }
  );
}

export function summarizePayload(
  toolName: string,
  data: Record<string, unknown>
): string {
  if (Array.isArray(data.items)) {
    return `${toolName} returned ${data.items.length} items`;
  }

  if (data.item && typeof data.item === "object" && data.item !== null) {
    const item = data.item as Record<string, unknown>;
    const label = pickLabel(item);
    return label ? `${toolName} returned ${label}` : `${toolName} returned an item`;
  }

  if (typeof data.modified === "number") {
    return `${toolName} modified ${data.modified} entries`;
  }

  if (typeof data.count === "number") {
    return `${toolName} count: ${data.count}`;
  }

  if (data.result === true) {
    return `${toolName} completed successfully`;
  }

  return `${toolName} returned a response`;
}

export function toToolErrorResult(error: unknown): CallToolResult {
  if (error instanceof RaindropApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            error.errorMessage ??
            `Raindrop API request failed with status ${error.status}`
        }
      ],
      structuredContent: {
        error: {
          status: error.status,
          error: error.error,
          errorMessage: error.errorMessage,
          rateLimit: error.rateLimit,
          details: error.details
        }
      }
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent: {
      error: {
        errorMessage: message
      }
    }
  };
}

function pickLabel(item: Record<string, unknown>): string | undefined {
  if (typeof item.title === "string" && item.title) {
    return item.title;
  }

  if (typeof item._id === "string" || typeof item._id === "number") {
    return `item ${String(item._id)}`;
  }

  return undefined;
}
