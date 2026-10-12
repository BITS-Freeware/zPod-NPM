export type ZpodApiConfig = {
  token: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type ZpodApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path}`;
}

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export class ZpodApiClient {
  readonly token: string;
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ZpodApiConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "") || "https://zpod.cc";
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async request(method: string, path: string, opts?: { query?: Record<string, string | undefined>; json?: unknown }): Promise<ZpodApiResult> {
    const url = new URL(joinUrl(this.baseUrl, path));
    for (const [k, v] of Object.entries(opts?.query ?? {})) {
      if (v) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept: "application/json",
    };
    let body: string | undefined;
    if (opts?.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const res = await this.fetchImpl(url.toString(), { method, headers, body });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { error: "invalid_json", message: text.slice(0, 400) };
    }
    return { ok: res.ok, status: res.status, body: parsed };
  }
}

export function clientFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch): ZpodApiClient {
  const token = String(env.ZPOD_API_TOKEN || "").trim();
  if (!token) {
    throw new Error("ZPOD_API_TOKEN is required. Create a Bearer token in Studio Account → Developer / API Tokens.");
  }
  const baseUrl = String(env.ZPOD_API_BASE || env.ZPOD_API_URL || "https://zpod.cc").trim() || "https://zpod.cc";
  return new ZpodApiClient({ token, baseUrl, fetchImpl });
}

export function pick(args: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (args[key] != null && args[key] !== "") return args[key];
  }
  return undefined;
}

export function episodeIdOf(args: Record<string, unknown>) {
  return str(pick(args, "episode_id", "episodeId", "id"));
}

export function showIdOf(args: Record<string, unknown>) {
  return str(pick(args, "show_id", "showId"));
}

export function createBody(args: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  const title = str(pick(args, "title"));
  if (title) body.title = title;
  const description = str(pick(args, "description", "notes"));
  if (description != null) body.description = description;
  if (args.allow_html != null || args.allowHtml != null) body.allowHtml = Boolean(pick(args, "allow_html", "allowHtml"));
  const season = num(pick(args, "season_number", "seasonNumber", "season"));
  if (season != null) body.seasonNumber = season;
  const episode = num(pick(args, "episode_number", "episodeNumber", "episode"));
  if (episode != null) body.episodeNumber = episode;
  if (args.explicit != null) body.explicit = Boolean(args.explicit);
  const episodeType = str(pick(args, "episode_type", "episodeType"));
  if (episodeType) body.episodeType = episodeType;
  if (args.is_private != null || args.isPrivate != null) body.isPrivate = Boolean(pick(args, "is_private", "isPrivate"));
  const publishedAt = str(pick(args, "published_at", "publishedAt", "publish_at", "publishAt"));
  if (publishedAt) body.publishedAt = publishedAt;
  return body;
}

export function mediaBody(args: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  const filename = str(pick(args, "filename", "file_name"));
  if (filename) body.filename = filename;
  const contentType = str(pick(args, "content_type", "contentType"));
  if (contentType) body.contentType = contentType;
  const byteSize = num(pick(args, "byte_size", "byteSize", "bytes"));
  if (byteSize != null) body.byteSize = byteSize;
  const ticket = str(pick(args, "ticket"));
  if (ticket) body.ticket = ticket;
  const duration = num(pick(args, "duration_seconds", "durationSeconds"));
  if (duration != null) body.durationSeconds = duration;
  return body;
}
