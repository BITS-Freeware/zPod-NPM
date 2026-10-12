# Changelog

## 1.39.1

- Release workflow only: `npm publish` now logs verbosely, so a failed trusted-publishing token exchange shows its reason. The 1.38.0 and 1.39.0 releases did not reach npm; this release carries their changes. The package itself is unchanged.

## 1.39.0

- The hosted server at `https://zpod.cc/mcp` now supports OAuth sign-in (zPod 1.100.0 or later), so apps that connect only through OAuth, such as the Claude and ChatGPT apps, can add it as a connector. The README's Hosted Server section explains both ways to connect. The tools are unchanged.

## 1.38.0

Tools for shows and custom domains, which need zPod 1.99.0 or later.

- `create_show` creates a show in one of the account's studios. `update_show` changes its settings. `set_show_cover` sets the cover from a public PNG or JPEG URL. These need the `shows:write` scope.
- `get_custom_domain` reads a show's custom domain and the DNS record to add. `set_custom_domain` adds or changes the domain, and `check_custom_domain` runs Check Hostname. Setting and checking need the `domains:write` scope.
- There is no tool to delete a show or remove a custom domain. Both stay in Studio.

## 1.37.0

Tools for archive episodes, which need zPod 1.98.0 or later.

- `list_episodes` takes `has_audio` and `offset`.
- `list_archive_candidates` lists imported drafts with no usable audio and why.
- `publish_as_archive` publishes the eligible ones as archive episodes, by id or all at once.

## 1.36.0

- New `whoami` tool. It calls `GET /api/v1/me` and returns the account the token acts for, the studios and show count it reaches, and its scopes, with a plain-words hint when the token reaches no shows. Needs zPod 1.97.0 or later.

## 1.35.0

First release from this repository.

- Published as a compiled package with type declarations. It no longer needs a TypeScript loader at runtime and has no runtime dependencies.
- The stdio transport now speaks newline-delimited JSON, as the MCP specification requires. Content-Length framing still works, and each reply uses the framing of its request.
- Content-Length frames are measured in bytes, so non-ASCII text no longer breaks framing.
- `serverInfo.version` now reports the package version.
