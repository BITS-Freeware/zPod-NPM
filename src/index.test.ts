import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ZpodApiClient,
  callMcpTool,
  clientFromEnv,
  handleMcpRequest,
  MCP_SERVER_VERSION,
  MCP_TOOLS,
  parseMcpFrames,
  parseStdioMessages,
  encodeMcpFrame,
  encodeMcpLine,
} from "./index.js";

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const out = handler(url, init);
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("zpod mcp", () => {
  it("lists the tool catalog without audio-byte tools", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual([
      "whoami",
      "list_shows",
      "get_show",
      "list_directory_links",
      "parse_directory_link",
      "find_directory_listings",
      "confirm_directory_listing",
      "set_directory_link",
      "list_episodes",
      "get_episode",
      "create_episode",
      "update_episode",
      "get_upload_url",
      "commit_media",
      "get_artwork_upload_url",
      "commit_artwork",
      "set_chapters",
      "get_transcript_upload_url",
      "commit_transcript",
      "validate_episode",
      "publish_episode",
      "unpublish_episode",
      "list_archive_candidates",
      "publish_as_archive",
    ]);
    expect(names).not.toContain("delete_episode");
    for (const tool of MCP_TOOLS) {
      const props = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
      expect(Object.keys(props).some((k) => k.toLowerCase().includes("base64") || k.toLowerCase().includes("audio_bytes"))).toBe(
        false,
      );
    }
  });

  it("wraps /api/v1 and maps insufficient_scope on publish", async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const client = new ZpodApiClient({
      token: "zpod_live_test",
      baseUrl: "https://zpod.cc",
      fetchImpl: mockFetch((url, init) => {
        calls.push({ method: String(init?.method || "GET"), url, body: typeof init?.body === "string" ? init.body : undefined });
        if (url.endsWith("/api/v1/shows")) {
          return { status: 200, body: { shows: [{ id: "s1", feedUrl: "https://rss.podfora.com/show-abc123" }] } };
        }
        if (url.includes("/publish")) {
          return { status: 403, body: { error: "insufficient_scope", message: "This token needs publish." } };
        }
        if (url.includes("/schedule")) {
          return { status: 200, body: { episode: { id: "e1", status: "scheduled" } } };
        }
        return { status: 200, body: { ok: true } };
      }),
    });
    const listed = await callMcpTool("list_shows", {}, client);
    expect(listed.isError).toBe(false);
    expect(listed.content[0]?.text).toContain("rss.podfora.com");
    expect(calls[0]?.url).toBe("https://zpod.cc/api/v1/shows");
    expect(calls[0]?.method).toBe("GET");

    await callMcpTool("whoami", {}, client);
    expect(calls.at(-1)?.url).toBe("https://zpod.cc/api/v1/me");
    expect(calls.at(-1)?.method).toBe("GET");

    const denied = await callMcpTool("publish_episode", { episode_id: "e1" }, client);
    expect(denied.isError).toBe(true);
    expect(denied.content[0]?.text).toContain("insufficient_scope");

    const scheduled = await callMcpTool("publish_episode", { episode_id: "e1", published_at: "06 Oct 2026 09:00" }, client);
    expect(scheduled.isError).toBe(false);
    expect(calls.at(-1)?.url).toContain("/schedule");
    expect(calls.at(-1)?.body).toContain("publishedAt");
  });

  it("lists drafts without audio and publishes them as archive episodes", async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const client = new ZpodApiClient({
      token: "zpod_live_test",
      baseUrl: "https://zpod.cc",
      fetchImpl: mockFetch((url, init) => {
        calls.push({ method: String(init?.method || "GET"), url, body: typeof init?.body === "string" ? init.body : undefined });
        return { status: 200, body: { ok: true } };
      }),
    });
    await callMcpTool("list_episodes", { show_id: "s1", status: "draft", has_audio: false, limit: 200, offset: 200 }, client);
    const listUrl = new URL(calls.at(-1)!.url);
    expect(listUrl.pathname).toBe("/api/v1/shows/s1/episodes");
    expect(Object.fromEntries(listUrl.searchParams)).toEqual({ status: "draft", limit: "200", offset: "200", hasAudio: "false" });

    await callMcpTool("list_archive_candidates", { show_id: "s1" }, client);
    expect(calls.at(-1)).toMatchObject({ method: "GET", url: "https://zpod.cc/api/v1/shows/s1/episodes/archive-candidates" });

    await callMcpTool("publish_as_archive", { show_id: "s1", episode_ids: ["e1", "e2"] }, client);
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "https://zpod.cc/api/v1/shows/s1/episodes/publish-archive" });
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ episodeIds: ["e1", "e2"] });

    await callMcpTool("publish_as_archive", { show_id: "s1", all: true }, client);
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ all: true });

    const before = calls.length;
    const missing = await callMcpTool("publish_as_archive", { show_id: "s1" }, client);
    expect(missing.isError).toBe(true);
    expect(calls.length).toBe(before);
  });

  it("handles MCP initialize and tools/list over JSON-RPC", async () => {
    const client = new ZpodApiClient({
      token: "zpod_live_test",
      baseUrl: "https://zpod.cc",
      fetchImpl: mockFetch(() => ({ status: 200, body: { shows: [] } })),
    });
    const init = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, client);
    expect(init?.result).toMatchObject({ protocolVersion: "2025-03-26", serverInfo: { name: "zpod", version: MCP_SERVER_VERSION } });
    const listed = await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, client);
    const tools = (listed?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toContain("get_upload_url");
    const frame = encodeMcpFrame({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    const parsed = parseMcpFrames(frame);
    expect(parsed.messages[0]?.method).toBe("tools/list");
  });

  it("reports the package version as the server version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(MCP_SERVER_VERSION).toBe(pkg.version);
  });

  it("reads newline-delimited stdio messages and keeps partial lines", () => {
    const first = encodeMcpLine({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const second = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const parsed = parseStdioMessages(first + second.slice(0, 10));
    expect(parsed.messages).toEqual([{ message: { jsonrpc: "2.0", id: 1, method: "initialize" }, framing: "line" }]);
    const done = parseStdioMessages(parsed.rest + second.slice(10) + "\n");
    expect(done.messages[0]).toMatchObject({ message: { method: "tools/list" }, framing: "line" });
    expect(done.rest).toBe("");
  });

  it("still reads Content-Length frames, counting bytes", () => {
    const frame = encodeMcpFrame({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_show", arguments: { show_id: "Psalmé ✝" } } });
    const parsed = parseStdioMessages(frame + encodeMcpLine({ jsonrpc: "2.0", id: 2, method: "ping" }));
    expect(parsed.messages.map((m) => m.framing)).toEqual(["content-length", "line"]);
    expect((parsed.messages[0]?.message.params as { arguments: { show_id: string } }).arguments.show_id).toBe("Psalmé ✝");
    const partial = parseMcpFrames(frame.slice(0, -2));
    expect(partial.messages).toEqual([]);
  });

  it("requires a token and defaults to zpod.cc", () => {
    expect(() => clientFromEnv({})).toThrow(/ZPOD_API_TOKEN/);
    expect(clientFromEnv({ ZPOD_API_TOKEN: "t" }).baseUrl).toBe("https://zpod.cc");
    expect(clientFromEnv({ ZPOD_API_TOKEN: "t", ZPOD_API_BASE: "https://example.test/" }).baseUrl).toBe("https://example.test");
  });
});
