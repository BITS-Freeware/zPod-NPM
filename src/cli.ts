#!/usr/bin/env node
import { runStdio } from "./stdio.js";

runStdio().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
