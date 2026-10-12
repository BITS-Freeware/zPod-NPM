# zPod MCP

`@zpod/mcp` is the official [Model Context Protocol](https://modelcontextprotocol.io) server for [zPod](https://zpod.cc). It runs on your own machine over stdio and turns the zPod REST API (`/api/v1`) into tools an AI client can call: list shows, create draft episodes, upload audio through presigned URLs, set chapters and transcripts, validate, and publish.

It is a thin wrapper. Every tool call is one request to `https://zpod.cc/api/v1` with your API token, so the server can do exactly what the token can do and nothing more. There is no hosted version.

## Requirements

- Node.js 20 or later
- A zPod API token. Create one in Studio under **Account → Developer / API Tokens**. Tokens start with `zpod_live_`. Publishing, scheduling, and unpublishing need a token with the `publish` scope.

## Set Up Your Client

Most clients take the same JSON block. Put your token in the `env` section, not in a prompt.

```json
{
  "mcpServers": {
    "zpod": {
      "command": "npx",
      "args": ["-y", "@zpod/mcp"],
      "env": {
        "ZPOD_API_TOKEN": "zpod_live_..."
      }
    }
  }
}
```

- **Claude Desktop:** add the block to `claude_desktop_config.json` and restart the app.
- **Cursor:** add it to `.cursor/mcp.json` in your project, or to the global MCP settings.
- **Claude Code:** `claude mcp add zpod --env ZPOD_API_TOKEN=zpod_live_... -- npx -y @zpod/mcp`

### Environment Variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `ZPOD_API_TOKEN` | Yes | Your zPod API token, sent as a Bearer token. |
| `ZPOD_API_BASE` | No | API origin. Defaults to `https://zpod.cc`. `ZPOD_API_URL` is accepted as an alias. |

## Tools

| Tool | What it does |
| --- | --- |
| `list_shows` | Lists the shows the token can see, with their canonical feed URLs. |
| `get_show` | Gets one show and its feed URL. |
| `list_directory_links` | Lists a show's saved and derived directory listing links. |
| `parse_directory_link` | Parses a pasted directory link without saving it. |
| `find_directory_listings` | Looks a show up on Apple Podcasts and Podcast Index and proposes ids. |
| `confirm_directory_listing` | Saves a proposal from `find_directory_listings`. |
| `set_directory_link` | Saves a directory link for a show. |
| `list_episodes` | Lists a show's episodes, optionally by status and by whether they have audio. Pages with `limit` and `offset`. |
| `get_episode` | Gets episode metadata, enclosure, artwork, chapters, and transcript URLs. |
| `create_episode` | Creates a draft episode. It never publishes. |
| `update_episode` | Updates a draft or scheduled episode. |
| `get_upload_url` | Returns a presigned URL for uploading episode audio. |
| `commit_media` | Attaches an uploaded audio file to the episode. |
| `get_artwork_upload_url` | Returns a presigned URL for episode artwork. |
| `commit_artwork` | Attaches uploaded artwork. |
| `set_chapters` | Replaces the episode's Podcasting 2.0 chapters. |
| `get_transcript_upload_url` | Returns a presigned URL for a WebVTT or plain-text transcript. |
| `commit_transcript` | Attaches an uploaded transcript. |
| `validate_episode` | Runs the publish checklist with no side effects. |
| `publish_episode` | Publishes now, or schedules when `published_at` is set. Needs the `publish` scope. |
| `unpublish_episode` | Returns an episode to draft. Files stay. Needs the `publish` scope. |
| `list_archive_candidates` | Lists imported drafts with no usable audio, with the reason for each, for a backlog imported from a show that kept audio only for a recent window. |
| `publish_as_archive` | Publishes those drafts as archive episodes: original date kept, listed on the show's website, left out of RSS, no podcast app notifications. Needs the `publish` scope. |

There is no delete tool.

### Uploading Files

Audio, artwork, and transcripts never pass through the model. Ask for an upload URL, upload the file to it yourself (for example with `curl -X PUT --upload-file`), then call the matching `commit_` tool with the returned ticket.

## Use It as a Library

The package also exports the client and the request handler.

```ts
import { ZpodApiClient, callMcpTool } from "@zpod/mcp";

const client = new ZpodApiClient({ token: process.env.ZPOD_API_TOKEN!, baseUrl: "https://zpod.cc" });
const result = await callMcpTool("list_shows", {}, client);
```

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm start` runs the built server from `dist/`.

## Versioning and Releases

Versions follow `a.b.c`: `a` for a major release or rewrite, `b` for a feature release, and `c` for a fix. Publishing a GitHub release tagged `v<version>` publishes that version to npm through npm trusted publishing, with provenance. See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
