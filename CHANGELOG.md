# Changelog

## 1.35.0

First release from this repository.

- Published as a compiled package with type declarations. It no longer needs a TypeScript loader at runtime and has no runtime dependencies.
- The stdio transport now speaks newline-delimited JSON, as the MCP specification requires. Content-Length framing still works, and each reply uses the framing of its request.
- Content-Length frames are measured in bytes, so non-ASCII text no longer breaks framing.
- `serverInfo.version` now reports the package version.
