import { stdin, stdout } from "node:process";
import { clientFromEnv } from "./client.js";
import { encodeMcpFrame, encodeMcpLine, handleMcpRequest, parseStdioMessages } from "./protocol.js";

export async function runStdio(env: NodeJS.ProcessEnv = process.env) {
  const client = clientFromEnv(env);
  let buffer = "";
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const parsed = parseStdioMessages(buffer);
    buffer = parsed.rest;
    for (const { message, framing } of parsed.messages) {
      void handleMcpRequest(message, client).then((res) => {
        if (!res) return;
        stdout.write(framing === "content-length" ? encodeMcpFrame(res) : encodeMcpLine(res));
      });
    }
  });
}
