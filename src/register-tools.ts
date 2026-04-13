import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { RaindropClient } from "./raindrop-client.js";
import { registerRaindropTool } from "./tool-helpers.js";

const emptyInputSchema = z.object({});
const genericObjectSchema = z.object({}).passthrough();
const collectionViewSchema = z.enum(["list", "simple", "grid", "masonry"]);
const raindropTypeSchema = z.enum([
  "link",
  "article",
  "image",
  "video",
  "document",
  "audio"
]);
const raindropSortSchema = z.enum([
  "-created",
  "created",
  "score",
  "-sort",
  "title",
  "-title",
  "domain",
  "-domain"
]);
const collectionSortSchema = z.enum(["title", "-title", "-count"]);
const exportFormatSchema = z.enum(["csv", "html", "zip"]);
const highlightColorSchema = z.enum([
  "blue",
  "brown",
  "cyan",
  "gray",
  "green",
  "indigo",
  "orange",
  "pink",
  "purple",
  "red",
  "teal",
  "yellow"
]);

const highlightCreateSchema = z.object({
  color: highlightColorSchema.optional(),
  note: z.string().optional(),
  text: z.string().min(1)
});

const highlightUpdateSchema = z.object({
  _id: z.string(),
  color: highlightColorSchema.optional(),
  note: z.string().optional(),
  text: z.string().optional()
});

const collectionBodySchema = z.object({
  cover: z.array(z.string()).optional(),
  public: z.boolean().optional(),
  ["parent.$id"]: z.number().int().optional(),
  sort: z.number().int().optional(),
  title: z.string().min(1).optional(),
  view: collectionViewSchema.optional()
});

const collectionUpdateBodySchema = collectionBodySchema.extend({
  expanded: z.boolean().optional()
});

const raindropWriteSchema = z.object({
  collection: z.object({ $id: z.number().int() }).optional(),
  cover: z.string().optional(),
  created: z.string().optional(),
  excerpt: z.string().optional(),
  highlights: z.array(genericObjectSchema).optional(),
  important: z.boolean().optional(),
  lastUpdate: z.string().optional(),
  link: z.string().min(1).optional(),
  media: z.array(genericObjectSchema).optional(),
  note: z.string().optional(),
  order: z.number().int().optional(),
  pleaseParse: genericObjectSchema.optional(),
  reminder: genericObjectSchema.optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().optional(),
  type: raindropTypeSchema.optional()
});

export function registerRaindropTools(server: McpServer, client: RaindropClient): void {
  registerRaindropTool(server, {
    name: "raindrop_user_get_me",
    description: "Get the currently authenticated Raindrop.io user.",
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: () => client.requestJson("GET", "/user")
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_list_root",
    description: "List root collections.",
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: () => client.requestJson("GET", "/collections")
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_list_children",
    description: "List nested child collections.",
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: () => client.requestJson("GET", "/collections/childrens")
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_get",
    description: "Get one collection by ID.",
    inputSchema: z.object({ id: z.number().int() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ id }) => client.requestJson("GET", `/collection/${id}`)
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_create",
    description: "Create a collection.",
    inputSchema: collectionBodySchema.refine((value) => Boolean(value.title), {
      message: "title is required"
    }),
    annotations: {},
    execute: (args) => client.requestJson("POST", "/collection", { body: args })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_update",
    description: "Update a collection.",
    inputSchema: z.object({
      id: z.number().int()
    }).extend(collectionUpdateBodySchema.shape),
    annotations: {},
    execute: ({ id, ...body }) => client.requestJson("PUT", `/collection/${id}`, { body })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_delete",
    description: "Delete a collection and move its bookmarks to Trash.",
    inputSchema: z.object({ id: z.number().int() }),
    annotations: { destructiveHint: true },
    execute: ({ id }) => client.requestJson("DELETE", `/collection/${id}`)
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_delete_many",
    description: "Delete multiple collections at once.",
    inputSchema: z.object({
      ids: z.array(z.number().int()).min(1)
    }),
    annotations: { destructiveHint: true },
    execute: ({ ids }) => client.requestJson("DELETE", "/collections", { body: { ids } })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_reorder_all",
    description: "Reorder all collections with one global sort mode.",
    inputSchema: z.object({
      sort: collectionSortSchema
    }),
    annotations: {},
    execute: ({ sort }) => client.requestJson("PUT", "/collections", { body: { sort } })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_set_expanded",
    description: "Expand or collapse all collections.",
    inputSchema: z.object({
      expanded: z.boolean()
    }),
    annotations: {},
    execute: ({ expanded }) => client.requestJson("PUT", "/collections", { body: { expanded } })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_merge",
    description: "Merge multiple collections into a destination collection.",
    inputSchema: z.object({
      ids: z.array(z.number().int()).min(1),
      to: z.number().int()
    }),
    annotations: { destructiveHint: true },
    execute: ({ ids, to }) => client.requestJson("PUT", "/collections/merge", { body: { ids, to } })
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_remove_empty",
    description: "Remove all empty collections.",
    inputSchema: emptyInputSchema,
    annotations: { destructiveHint: true },
    execute: () => client.requestJson("PUT", "/collections/clean")
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_empty_trash",
    description: "Permanently empty the Trash collection.",
    inputSchema: emptyInputSchema,
    annotations: { destructiveHint: true },
    execute: () => client.requestJson("DELETE", "/collection/-99")
  });

  registerRaindropTool(server, {
    name: "raindrop_collections_get_system_counts",
    description: "Get counts for system collections and bookmark stats.",
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: () => client.requestJson("GET", "/user/stats")
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_list",
    description: "List bookmarks in a collection.",
    inputSchema: z.object({
      collectionId: z.number().int(),
      nested: z.boolean().optional(),
      page: z.number().int().min(0).optional(),
      perpage: z.number().int().min(1).max(50).optional(),
      search: z.string().optional(),
      sort: raindropSortSchema.optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ collectionId, ...query }) =>
      client.requestJson("GET", `/raindrops/${collectionId}`, { query })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_get",
    description: "Get one bookmark by ID.",
    inputSchema: z.object({ id: z.number().int() }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ id }) => client.requestJson("GET", `/raindrop/${id}`)
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_create",
    description: "Create one bookmark.",
    inputSchema: raindropWriteSchema.extend({
      link: z.string().min(1)
    }),
    annotations: {},
    execute: (body) => client.requestJson("POST", "/raindrop", { body })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_update",
    description: "Update one bookmark.",
    inputSchema: z.object({
      id: z.number().int()
    }).extend(raindropWriteSchema.shape),
    annotations: {},
    execute: ({ id, ...body }) => client.requestJson("PUT", `/raindrop/${id}`, { body })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_delete",
    description: "Delete one bookmark. If it is already in Trash, it is removed permanently.",
    inputSchema: z.object({ id: z.number().int() }),
    annotations: { destructiveHint: true },
    execute: ({ id }) => client.requestJson("DELETE", `/raindrop/${id}`)
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_create_many",
    description: "Create up to 100 bookmarks in one request.",
    inputSchema: z.object({
      items: z.array(raindropWriteSchema.extend({ link: z.string().min(1) })).min(1).max(100)
    }),
    annotations: {},
    execute: ({ items }) => client.requestJson("POST", "/raindrops", { body: { items } })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_update_many",
    description: "Bulk update bookmarks in a collection.",
    inputSchema: z.object({
      collection: z.object({ $id: z.number().int() }).optional(),
      collectionId: z.number().int(),
      cover: z.string().optional(),
      ids: z.array(z.number().int()).optional(),
      important: z.boolean().optional(),
      media: z.array(genericObjectSchema).optional(),
      nested: z.boolean().optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional()
    }),
    annotations: { destructiveHint: true },
    execute: ({ collectionId, nested, search, ...body }) =>
      client.requestJson("PUT", `/raindrops/${collectionId}`, {
        query: { nested, search },
        body
      })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_delete_many",
    description: "Delete multiple bookmarks in a collection, optionally filtered by ids or search.",
    inputSchema: z.object({
      collectionId: z.number().int(),
      ids: z.array(z.number().int()).optional(),
      nested: z.boolean().optional(),
      search: z.string().optional()
    }),
    annotations: { destructiveHint: true },
    execute: ({ collectionId, nested, search, ids }) =>
      client.requestJson("DELETE", `/raindrops/${collectionId}`, {
        query: { nested, search },
        body: ids ? { ids } : undefined
      })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_suggest_for_new",
    description: "Suggest collections and tags for a new bookmark URL.",
    inputSchema: z.object({
      link: z.string().min(1)
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ link }) => client.requestJson("POST", "/raindrop/suggest", { body: { link } })
  });

  registerRaindropTool(server, {
    name: "raindrop_raindrops_suggest_for_existing",
    description: "Suggest collections and tags for an existing bookmark.",
    inputSchema: z.object({
      id: z.number().int()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ id }) => client.requestJson("GET", `/raindrop/${id}/suggest`)
  });

  registerRaindropTool(server, {
    name: "raindrop_tags_list",
    description: "List tags, optionally scoped to one collection.",
    inputSchema: z.object({
      collectionId: z.number().int().optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ collectionId }) =>
      client.requestJson("GET", collectionId === undefined ? "/tags" : `/tags/${collectionId}`)
  });

  registerRaindropTool(server, {
    name: "raindrop_tags_rename",
    description: "Rename one tag, optionally within one collection.",
    inputSchema: z.object({
      collectionId: z.number().int().optional(),
      replace: z.string().min(1),
      tags: z.array(z.string().min(1)).length(1)
    }),
    annotations: {},
    execute: ({ collectionId, replace, tags }) =>
      client.requestJson("PUT", collectionId === undefined ? "/tags" : `/tags/${collectionId}`, {
        body: { replace, tags }
      })
  });

  registerRaindropTool(server, {
    name: "raindrop_tags_merge",
    description: "Merge multiple tags into one replacement tag.",
    inputSchema: z.object({
      collectionId: z.number().int().optional(),
      replace: z.string().min(1),
      tags: z.array(z.string().min(1)).min(1)
    }),
    annotations: { destructiveHint: true },
    execute: ({ collectionId, replace, tags }) =>
      client.requestJson("PUT", collectionId === undefined ? "/tags" : `/tags/${collectionId}`, {
        body: { replace, tags }
      })
  });

  registerRaindropTool(server, {
    name: "raindrop_tags_remove",
    description: "Remove tags, optionally within one collection.",
    inputSchema: z.object({
      collectionId: z.number().int().optional(),
      tags: z.array(z.string().min(1)).min(1)
    }),
    annotations: { destructiveHint: true },
    execute: ({ collectionId, tags }) =>
      client.requestJson("DELETE", collectionId === undefined ? "/tags" : `/tags/${collectionId}`, {
        body: { tags }
      })
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_list_all",
    description: "List all highlights.",
    inputSchema: z.object({
      page: z.number().int().min(0).optional(),
      perpage: z.number().int().min(1).max(50).optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: (query) => client.requestJson("GET", "/highlights", { query })
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_list_collection",
    description: "List highlights in one collection.",
    inputSchema: z.object({
      collectionId: z.number().int(),
      page: z.number().int().min(0).optional(),
      perpage: z.number().int().min(1).max(50).optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ collectionId, ...query }) =>
      client.requestJson("GET", `/highlights/${collectionId}`, { query })
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_list_raindrop",
    description: "List highlights attached to one bookmark.",
    inputSchema: z.object({
      id: z.number().int()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: async ({ id }) => {
      const data = await client.requestJson<Record<string, unknown>>("GET", `/raindrop/${id}`);
      const item =
        data.item && typeof data.item === "object" && data.item !== null
          ? (data.item as Record<string, unknown>)
          : {};

      return {
        result: data.result,
        item: {
          _id: id,
          highlights: Array.isArray(item.highlights) ? item.highlights : []
        }
      };
    }
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_add",
    description: "Add one or more highlights to a bookmark.",
    inputSchema: z.object({
      highlights: z.array(highlightCreateSchema).min(1),
      id: z.number().int()
    }),
    annotations: {},
    execute: ({ id, highlights }) =>
      client.requestJson("PUT", `/raindrop/${id}`, { body: { highlights } })
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_update",
    description: "Update highlights on a bookmark.",
    inputSchema: z.object({
      highlights: z.array(highlightUpdateSchema).min(1),
      id: z.number().int()
    }),
    annotations: {},
    execute: ({ id, highlights }) =>
      client.requestJson("PUT", `/raindrop/${id}`, { body: { highlights } })
  });

  registerRaindropTool(server, {
    name: "raindrop_highlights_remove",
    description: "Remove highlights from a bookmark by sending empty text values.",
    inputSchema: z.object({
      highlights: z
        .array(
          z.object({
            _id: z.string(),
            text: z.literal("")
          })
        )
        .min(1),
      id: z.number().int()
    }),
    annotations: { destructiveHint: true },
    execute: ({ id, highlights }) =>
      client.requestJson("PUT", `/raindrop/${id}`, { body: { highlights } })
  });

  registerRaindropTool(server, {
    name: "raindrop_filters_list",
    description: "List context-aware filters for bookmarks in a collection.",
    inputSchema: z.object({
      collectionId: z.number().int(),
      search: z.string().optional(),
      tagsSort: z.enum(["-count", "_id"]).optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ collectionId, ...query }) =>
      client.requestJson("GET", `/filters/${collectionId}`, { query })
  });

  registerRaindropTool(server, {
    name: "raindrop_import_parse_url",
    description: "Parse a URL and extract bookmark metadata.",
    inputSchema: z.object({
      url: z.string().min(1)
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ url }) => client.requestJson("GET", "/import/url/parse", { query: { url } })
  });

  registerRaindropTool(server, {
    name: "raindrop_import_check_urls",
    description: "Check whether one or more URLs are already saved.",
    inputSchema: z.object({
      urls: z.array(z.string().min(1)).min(1)
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ urls }) => client.requestJson("POST", "/import/url/exists", { body: { urls } })
  });

  registerRaindropTool(server, {
    name: "raindrop_export_collection",
    description: "Export bookmarks from a collection as CSV, HTML, or ZIP.",
    inputSchema: z.object({
      collectionId: z.number().int(),
      format: exportFormatSchema,
      search: z.string().optional(),
      sort: raindropSortSchema.optional()
    }),
    annotations: { readOnlyHint: true, idempotentHint: true },
    execute: ({ collectionId, format, search, sort }) =>
      client.exportCollection(collectionId, format, { search, sort }),
    summarize: (data, args) =>
      `raindrop_export_collection exported collection ${args.collectionId} as ${args.format} (${String(data.contentType)})`
  });
}
