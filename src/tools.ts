import {
  createBody,
  episodeIdOf,
  mediaBody,
  showIdOf,
  ZpodApiClient,
  type ZpodApiResult,
} from "./client.js";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const idSchema = (name: string, description: string) => ({
  type: "object",
  required: [name],
  additionalProperties: false,
  properties: { [name]: { type: "string", description } },
});

export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_shows",
    description: "List shows visible to this API token. Returns ids and canonical rss.podfora.com feed URLs. Never include audio bytes.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_show",
    description: "Get one show plus its canonical feed URL.",
    inputSchema: idSchema("show_id", "Show id"),
  },
  {
    name: "list_directory_links",
    description: "List stored and derived Listen Links for a show. Returns normalized https listing URLs. Does not change RSS.",
    inputSchema: idSchema("show_id", "Show id"),
  },
  {
    name: "parse_directory_link",
    description: "Parse a pasted directory listing link. Detects the directory and strips tracking. Does not save.",
    inputSchema: {
      type: "object",
      required: ["show_id", "input"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string", description: "Show id" },
        input: { type: "string", description: "Pasted listing URL or Apple collection id" },
      },
    },
  },
  {
    name: "find_directory_listings",
    description: "Look up Apple Podcasts and Podcast Index by feed URL. Proposes ids only. Does not save.",
    inputSchema: idSchema("show_id", "Show id"),
  },
  {
    name: "confirm_directory_listing",
    description: "Save a Find My Listings proposal after confirm. Never invents an id.",
    inputSchema: {
      type: "object",
      required: ["show_id", "lookup_id", "directory"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        lookup_id: { type: "string" },
        directory: { type: "string", enum: ["apple", "podcast_index"] },
      },
    },
  },
  {
    name: "set_directory_link",
    description: "Save a directory listing link for a show. Pasting a valid link marks that directory Listed.",
    inputSchema: {
      type: "object",
      required: ["show_id", "directory"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        directory: { type: "string" },
        url: { type: "string" },
        input: { type: "string" },
        hidden: { type: "boolean" },
        status: { type: "string", enum: ["not_started", "submitted", "listed"] },
      },
    },
  },
  {
    name: "list_episodes",
    description:
      "List episodes for a show. Optional filters: status (draft, scheduled, published, unlisted) and has_audio. Pages with limit (max 200) and offset; the reply has total and nextOffset.",
    inputSchema: {
      type: "object",
      required: ["show_id"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        status: { type: "string", enum: ["draft", "scheduled", "published", "unlisted"] },
        has_audio: { type: "boolean", description: "true: only episodes with playable media. false: only episodes without." },
        limit: { type: "integer" },
        offset: { type: "integer" },
      },
    },
  },
  {
    name: "get_episode",
    description: "Get episode metadata, enclosure URL, artwork, chapters, and transcript URLs. Do not fetch audio into context.",
    inputSchema: idSchema("episode_id", "Episode id"),
  },
  {
    name: "create_episode",
    description: "Create a draft episode. Never auto-publishes. Title required.",
    inputSchema: {
      type: "object",
      required: ["show_id", "title"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        allow_html: { type: "boolean" },
        season_number: { type: "integer" },
        episode_number: { type: "integer" },
        explicit: { type: "boolean" },
        episode_type: { type: "string" },
        published_at: { type: "string", description: "Stored as draft metadata only until publish/schedule." },
      },
    },
  },
  {
    name: "update_episode",
    description: "Patch draft or scheduled episode metadata. 409 if the episode is published.",
    inputSchema: {
      type: "object",
      required: ["episode_id"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        allow_html: { type: "boolean" },
        season_number: { type: "integer" },
        episode_number: { type: "integer" },
        explicit: { type: "boolean" },
        episode_type: { type: "string" },
        published_at: { type: "string" },
      },
    },
  },
  {
    name: "get_upload_url",
    description: "Presign an audio PUT URL. Put the file bytes yourself. Never pass base64 audio through this tool.",
    inputSchema: {
      type: "object",
      required: ["episode_id"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        filename: { type: "string" },
        content_type: { type: "string" },
        byte_size: { type: "integer" },
      },
    },
  },
  {
    name: "commit_media",
    description: "Bind a completed audio upload ticket. Episode stays draft. Fires media.ready for webhooks.",
    inputSchema: {
      type: "object",
      required: ["episode_id", "ticket"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        ticket: { type: "string" },
        byte_size: { type: "integer" },
        duration_seconds: { type: "number" },
      },
    },
  },
  {
    name: "get_artwork_upload_url",
    description: "Presign episode artwork PUT (square PNG/JPEG 1400–3000). Do not send image bytes in the model context.",
    inputSchema: {
      type: "object",
      required: ["episode_id"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        filename: { type: "string" },
        content_type: { type: "string" },
        byte_size: { type: "integer" },
      },
    },
  },
  {
    name: "commit_artwork",
    description: "Commit episode artwork after the presigned PUT.",
    inputSchema: {
      type: "object",
      required: ["episode_id", "ticket"],
      additionalProperties: false,
      properties: { episode_id: { type: "string" }, ticket: { type: "string" } },
    },
  },
  {
    name: "set_chapters",
    description: "Replace Podcasting 2.0 chapters JSON (startTime + title).",
    inputSchema: {
      type: "object",
      required: ["episode_id", "chapters"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        chapters: {
          type: "array",
          items: {
            type: "object",
            required: ["startTime", "title"],
            properties: {
              startTime: { type: "number" },
              title: { type: "string" },
              url: { type: "string" },
              img: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "get_transcript_upload_url",
    description: "Presign a WebVTT or plain-text transcript PUT. Do not send the transcript file through the model if it is large; use the URL.",
    inputSchema: {
      type: "object",
      required: ["episode_id"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        filename: { type: "string" },
        content_type: { type: "string" },
        byte_size: { type: "integer" },
      },
    },
  },
  {
    name: "commit_transcript",
    description: "Commit a transcript sidecar after the presigned PUT.",
    inputSchema: {
      type: "object",
      required: ["episode_id", "ticket"],
      additionalProperties: false,
      properties: { episode_id: { type: "string" }, ticket: { type: "string" } },
    },
  },
  {
    name: "validate_episode",
    description: "Publish checklist with no side effects. Same items as Studio.",
    inputSchema: idSchema("episode_id", "Episode id"),
  },
  {
    name: "publish_episode",
    description: "Publish now, or schedule when published_at is set. Requires token publish scope; otherwise returns insufficient_scope.",
    inputSchema: {
      type: "object",
      required: ["episode_id"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        published_at: {
          type: "string",
          description: "If set, POST /schedule in the show timezone. ISO, naive local, or dd MMM YYYY HH:mm.",
        },
      },
    },
  },
  {
    name: "unpublish_episode",
    description: "Soft-hide to draft. Files stay. Requires token publish scope.",
    inputSchema: idSchema("episode_id", "Episode id"),
  },
  {
    name: "list_archive_candidates",
    description:
      "For a backlog imported from a show that kept audio only for a recent window: imported drafts with no usable audio, each with a reason. eligible (no enclosure in the source, or the audio returned 404/410) can be published as archive episodes; attention (other copy failures) should be retried from the import instead.",
    inputSchema: idSchema("show_id", "Show id"),
  },
  {
    name: "publish_as_archive",
    description:
      "Publish imported drafts whose source audio is gone as archive episodes: keeps GUID and original date, clears the dead audio reference, lists them on the show's website, keeps them out of RSS, and notifies no podcast apps. Pass episode_ids (up to 5,000) or all: true. Ineligible ids come back in skipped with a reason. Requires token publish scope.",
    inputSchema: {
      type: "object",
      required: ["show_id"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        episode_ids: { type: "array", items: { type: "string" }, maxItems: 5000 },
        all: { type: "boolean", description: "Every eligible draft in the show." },
      },
    },
  },
];

export function mcpToolResult(result: ZpodApiResult) {
  const text = JSON.stringify(result.body, null, 2);
  const isError = !result.ok;
  return {
    content: [{ type: "text" as const, text: isError ? formatApiError(result) : text }],
    isError,
  };
}

function formatApiError(result: ZpodApiResult) {
  const body = result.body as { error?: string; message?: string } | null;
  const code = body && typeof body === "object" ? body.error : undefined;
  const message = body && typeof body === "object" ? body.message : undefined;
  if (code === "insufficient_scope") {
    return `insufficient_scope (${result.status}): ${message || "This token is missing a required scope."}`;
  }
  return JSON.stringify(result.body, null, 2);
}

function missing(field: string) {
  return mcpToolResult({ ok: false, status: 400, body: { error: "invalid_arguments", message: `${field} is required.` } });
}

export async function callMcpTool(name: string, rawArgs: unknown, client: ZpodApiClient) {
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
  switch (name) {
    case "list_shows":
      return mcpToolResult(await client.request("GET", "/api/v1/shows"));
    case "get_show": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}`));
    }
    case "list_directory_links": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}/directory-links`));
    }
    case "parse_directory_link": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const input = typeof args.input === "string" ? args.input : "";
      if (!input) return missing("input");
      return mcpToolResult(
        await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/directory-links/parse`, {
          json: { input },
        }),
      );
    }
    case "find_directory_listings": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/directory-links/find`),
      );
    }
    case "confirm_directory_listing": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const lookupId = typeof args.lookup_id === "string" ? args.lookup_id : "";
      const directory = typeof args.directory === "string" ? args.directory : "";
      if (!lookupId) return missing("lookup_id");
      if (!directory) return missing("directory");
      return mcpToolResult(
        await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/directory-links/find/confirm`, {
          json: { lookupId, directory },
        }),
      );
    }
    case "set_directory_link": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const directory = typeof args.directory === "string" ? args.directory : "";
      if (!directory) return missing("directory");
      return mcpToolResult(
        await client.request("PUT", `/api/v1/shows/${encodeURIComponent(showId)}/directory-links/${encodeURIComponent(directory)}`, {
          json: {
            url: args.url,
            input: args.input,
            hidden: args.hidden,
            status: args.status,
          },
        }),
      );
    }
    case "list_episodes": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const status = typeof args.status === "string" ? args.status : undefined;
      const limit = args.limit != null ? String(args.limit) : undefined;
      const offset = args.offset != null ? String(args.offset) : undefined;
      const hasAudio = typeof args.has_audio === "boolean" ? String(args.has_audio) : undefined;
      return mcpToolResult(
        await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}/episodes`, {
          query: { status, limit, offset, hasAudio },
        }),
      );
    }
    case "list_archive_candidates": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}/episodes/archive-candidates`));
    }
    case "publish_as_archive": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const ids = Array.isArray(args.episode_ids) ? args.episode_ids.filter((id): id is string => typeof id === "string") : [];
      if (args.all !== true && !ids.length) return missing("episode_ids or all");
      return mcpToolResult(
        await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/episodes/publish-archive`, {
          json: args.all === true ? { all: true } : { episodeIds: ids },
        }),
      );
    }
    case "get_episode": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(await client.request("GET", `/api/v1/episodes/${encodeURIComponent(episodeId)}`));
    }
    case "create_episode": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/episodes`, { json: createBody(args) }),
      );
    }
    case "update_episode": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("PATCH", `/api/v1/episodes/${encodeURIComponent(episodeId)}`, { json: createBody(args) }),
      );
    }
    case "get_upload_url": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/media/presign`, { json: mediaBody(args) }),
      );
    }
    case "commit_media": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/media/commit`, { json: mediaBody(args) }),
      );
    }
    case "get_artwork_upload_url": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/artwork/presign`, { json: mediaBody(args) }),
      );
    }
    case "commit_artwork": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/artwork/commit`, { json: mediaBody(args) }),
      );
    }
    case "set_chapters": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("PUT", `/api/v1/episodes/${encodeURIComponent(episodeId)}/chapters`, {
          json: { chapters: args.chapters },
        }),
      );
    }
    case "get_transcript_upload_url": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/transcript/presign`, {
          json: mediaBody(args),
        }),
      );
    }
    case "commit_transcript": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(
        await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/transcript/commit`, {
          json: mediaBody(args),
        }),
      );
    }
    case "validate_episode": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/validate`));
    }
    case "publish_episode": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      const publishedAt = args.published_at ?? args.publishedAt ?? args.publish_at;
      if (publishedAt) {
        return mcpToolResult(
          await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/schedule`, {
            json: { publishedAt },
          }),
        );
      }
      return mcpToolResult(await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/publish`));
    }
    case "unpublish_episode": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      return mcpToolResult(await client.request("POST", `/api/v1/episodes/${encodeURIComponent(episodeId)}/unpublish`));
    }
    default:
      return mcpToolResult({ ok: false, status: 404, body: { error: "unknown_tool", message: `Unknown tool: ${name}` } });
  }
}
