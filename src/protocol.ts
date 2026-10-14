import { callMcpTool, MCP_TOOLS } from "./tools.js";
import type { ZpodApiClient } from "./client.js";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const MCP_SERVER_NAME = "zpod";
// Keep in step with package.json; a test checks they match.
export const MCP_SERVER_VERSION = "1.40.1";

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export async function handleMcpRequest(msg: JsonRpcRequest, client: ZpodApiClient): Promise<JsonRpcResponse | null> {
  const method = String(msg.method || "");
  if (method.startsWith("notifications/")) return null;
  const id = msg.id ?? null;
  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
          instructions:
            "zPod MCP wraps https://zpod.cc/api/v1 with the same Bearer token scopes. Use presign URLs for audio, artwork, and transcripts. Never put file bytes or base64 audio in tool arguments or chat.",
        },
      };
    }
    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    }
    if (method === "tools/call") {
      const params = (msg.params ?? {}) as { name?: string; arguments?: unknown };
      const name = String(params.name || "");
      const result = await callMcpTool(name, params.arguments ?? {}, client);
      return { jsonrpc: "2.0", id, result };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    return { jsonrpc: "2.0", id, error: { code: -32000, message } };
  }
}

export function encodeMcpFrame(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json).byteLength;
  return `Content-Length: ${bytes}\r\n\r\n${json}`;
}

export type StdioFraming = "line" | "content-length";

export type StdioMessage = { message: JsonRpcRequest; framing: StdioFraming };

/** Newline-delimited JSON, the framing the MCP stdio transport specifies. */
export function encodeMcpLine(payload: unknown): string {
  return `${JSON.stringify(payload)}\n`;
}

/**
 * Read complete messages from a stdio buffer. Accepts newline-delimited JSON
 * (the MCP stdio transport) and Content-Length framing (older clients), and
 * reports which one each message used so the reply can match it.
 */
export function parseStdioMessages(buffer: string): { messages: StdioMessage[]; rest: string } {
  const messages: StdioMessage[] = [];
  let rest = buffer;
  while (rest.length) {
    const start = rest.search(/\S/);
    if (start === -1) return { messages, rest: "" };
    rest = rest.slice(start);
    if (/^content-length:/i.test(rest)) {
      const framed = parseMcpFrames(rest, 1);
      if (!framed.consumed) break;
      rest = framed.rest;
      for (const message of framed.messages) messages.push({ message, framing: "content-length" });
      continue;
    }
    const newline = rest.indexOf("\n");
    if (newline === -1) break;
    const line = rest.slice(0, newline).trim();
    rest = rest.slice(newline + 1);
    try {
      messages.push({ message: JSON.parse(line) as JsonRpcRequest, framing: "line" });
    } catch {
      /* skip malformed */
    }
  }
  return { messages, rest };
}

export function parseMcpFrames(buffer: string, max = Infinity): { messages: JsonRpcRequest[]; rest: string; consumed: number } {
  const messages: JsonRpcRequest[] = [];
  let rest = buffer;
  let consumed = 0;
  while (rest.length && consumed < max) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = rest.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      rest = rest.slice(headerEnd + 4);
      consumed++;
      continue;
    }
    const len = Number(match[1]);
    const start = headerEnd + 4;
    // Content-Length counts bytes, not UTF-16 code units.
    const body = new TextEncoder().encode(rest.slice(start));
    if (body.byteLength < len) break;
    const raw = new TextDecoder().decode(body.subarray(0, len));
    rest = new TextDecoder().decode(body.subarray(len));
    consumed++;
    try {
      messages.push(JSON.parse(raw) as JsonRpcRequest);
    } catch {
      /* skip malformed */
    }
  }
  return { messages, rest, consumed };
}
