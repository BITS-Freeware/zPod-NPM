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
    name: "whoami",
    description:
      "Which zPod account this API token acts for, the studios and show count it reaches, and its scopes. Call this first. A hint says why the token reaches no shows.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
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
    name: "create_show",
    description:
      "Create a show in one of the account's studios. Plan show limits apply, as in Studio. studio_id is required when the account belongs to more than one studio (see whoami). Requires token shows:write scope and a token with no show filter.",
    inputSchema: {
      type: "object",
      required: ["title"],
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        studio_id: { type: "string" },
        description: { type: "string" },
        author: { type: "string" },
        language: { type: "string", description: "Language code, such as en or en-US." },
        time_zone: { type: "string", description: "City time zone, such as America/Chicago." },
        feed_mode: { type: "string", enum: ["public", "unlisted", "paid"] },
        category: { type: "string", description: "Apple Podcasts category." },
        subcategory: { type: "string" },
        owner_email: { type: "string" },
        copyright: { type: "string" },
        transcript_generation: {
          type: "string",
          enum: ["disabled", "disabled_per_episode", "enabled", "enabled_per_episode"],
          description:
            "Speech-to-text for new audio. disabled: never. disabled_per_episode (default): off unless an episode turns it on. enabled: every episode. enabled_per_episode: on unless an episode turns it off.",
        },
      },
    },
  },
  {
    name: "update_show",
    description:
      "Change show settings. Only the fields you pass change. owner_email needs an owner or admin role on the show. Shows cannot be deleted through the API. Requires token shows:write scope.",
    inputSchema: {
      type: "object",
      required: ["show_id"],
      additionalProperties: false,
      properties: {
        show_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        author: { type: "string" },
        language: { type: "string" },
        explicit: { type: "boolean" },
        copyright: { type: "string" },
        time_zone: { type: "string" },
        download_filename_strategy: { type: "string" },
        transcript_generation: {
          type: "string",
          enum: ["disabled", "disabled_per_episode", "enabled", "enabled_per_episode"],
          description:
            "Speech-to-text for new audio. disabled: never. disabled_per_episode (default): off unless an episode turns it on. enabled: every episode. enabled_per_episode: on unless an episode turns it off.",
        },
        owner_email: { type: "string" },
        category: { type: "string" },
        subcategory: { type: "string" },
      },
    },
  },
  {
    name: "set_show_cover",
    description:
      "Set a show's cover from a public PNG or JPEG URL (at least 1400x1400). WebP and AVIF are refused. Requires token shows:write scope.",
    inputSchema: {
      type: "object",
      required: ["show_id", "url"],
      additionalProperties: false,
      properties: { show_id: { type: "string" }, url: { type: "string" } },
    },
  },
  {
    name: "get_custom_domain",
    description: "A show's custom domain, its status, whether the studio has the Custom Hostname add-on, and the DNS record to add.",
    inputSchema: idSchema("show_id", "Show id"),
  },
  {
    name: "set_custom_domain",
    description:
      "Add or change a show's custom domain and try to attach it. The reply has the CNAME record to add and a plain-words diagnosis. Removing a domain is not possible through the API; it is done in Studio. Needs the Custom Hostname add-on, an owner or admin role on the show, and token domains:write scope.",
    inputSchema: {
      type: "object",
      required: ["show_id", "hostname"],
      additionalProperties: false,
      properties: { show_id: { type: "string" }, hostname: { type: "string" } },
    },
  },
  {
    name: "check_custom_domain",
    description: "Check Hostname: re-check DNS for the saved custom domain and attach it once it points at zPod. Requires token domains:write scope.",
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
        transcript_generation: {
          type: "string",
          enum: ["enabled", "disabled", "show"],
          description:
            "Per-episode override. Only shows set to disabled_per_episode or enabled_per_episode take one; show clears it.",
        },
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
        transcript_generation: {
          type: "string",
          enum: ["enabled", "disabled", "show"],
          description:
            "Per-episode override. Only shows set to disabled_per_episode or enabled_per_episode take one; show clears it.",
        },
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
    name: "set_transcript_generation",
    description:
      "Turn speech-to-text transcript generation on or off for one episode, on any status. Only shows whose transcript_generation is disabled_per_episode or enabled_per_episode accept it (409 transcript_generation_locked otherwise). Turning it on queues a transcript when the episode already has audio and no transcript. Requires token episodes:write scope.",
    inputSchema: {
      type: "object",
      required: ["episode_id", "generation"],
      additionalProperties: false,
      properties: {
        episode_id: { type: "string" },
        generation: { type: "string", enum: ["enabled", "disabled", "show"], description: "show follows the show setting." },
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

/** MCP snake_case show fields to the API's camelCase body. Only fields that were passed are sent. */
function showBody(args: Record<string, unknown>) {
  const map: Record<string, string> = {
    title: "title",
    studio_id: "studioId",
    description: "description",
    author: "author",
    language: "language",
    explicit: "explicit",
    copyright: "copyright",
    time_zone: "timeZone",
    feed_mode: "feedMode",
    download_filename_strategy: "downloadFilenameStrategy",
    transcript_generation: "transcriptGeneration",
    owner_email: "ownerEmail",
    category: "category",
    subcategory: "subcategory",
  };
  const body: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(map)) if (args[from] !== undefined) body[to] = args[from];
  return body;
}

function missing(field: string) {
  return mcpToolResult({ ok: false, status: 400, body: { error: "invalid_arguments", message: `${field} is required.` } });
}

export async function callMcpTool(name: string, rawArgs: unknown, client: ZpodApiClient) {
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};
  switch (name) {
    case "whoami":
      return mcpToolResult(await client.request("GET", "/api/v1/me"));
    case "list_shows":
      return mcpToolResult(await client.request("GET", "/api/v1/shows"));
    case "get_show": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}`));
    }
    case "create_show": {
      const title = typeof args.title === "string" ? args.title : "";
      if (!title) return missing("title");
      return mcpToolResult(await client.request("POST", "/api/v1/shows", { json: showBody(args) }));
    }
    case "update_show": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("PATCH", `/api/v1/shows/${encodeURIComponent(showId)}`, { json: showBody(args) }));
    }
    case "set_show_cover": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const url = typeof args.url === "string" ? args.url : "";
      if (!url) return missing("url");
      return mcpToolResult(await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/artwork/url`, { json: { url } }));
    }
    case "get_custom_domain": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("GET", `/api/v1/shows/${encodeURIComponent(showId)}/custom-domain`));
    }
    case "set_custom_domain": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      const hostname = typeof args.hostname === "string" ? args.hostname.trim() : "";
      if (!hostname) return missing("hostname");
      return mcpToolResult(
        await client.request("PUT", `/api/v1/shows/${encodeURIComponent(showId)}/custom-domain`, { json: { hostname } }),
      );
    }
    case "check_custom_domain": {
      const showId = showIdOf(args);
      if (!showId) return missing("show_id");
      return mcpToolResult(await client.request("POST", `/api/v1/shows/${encodeURIComponent(showId)}/custom-domain/check`));
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
    case "set_transcript_generation": {
      const episodeId = episodeIdOf(args);
      if (!episodeId) return missing("episode_id");
      if (typeof args.generation !== "string" || !args.generation) return missing("generation");
      return mcpToolResult(
        await client.request("PUT", `/api/v1/episodes/${encodeURIComponent(episodeId)}/transcript-generation`, {
          json: { generation: args.generation },
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
