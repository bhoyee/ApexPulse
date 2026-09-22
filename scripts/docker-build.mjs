#!/usr/bin/env node
// Builds the Docker image(s) with GIT_COMMIT/BUILD_DATE stamped in, so the
// running app can show exactly which commit is deployed (see lib/version.ts).
import { execSync, spawnSync } from "node:child_process";

function safeExec(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const gitCommit = safeExec("git rev-parse --short HEAD", "unknown");
const buildDate = new Date().toISOString();

console.log(`Building ApexPulse image (commit ${gitCommit}, built ${buildDate})`);

const result = spawnSync("docker", ["compose", "build", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, GIT_COMMIT: gitCommit, BUILD_DATE: buildDate }
});

process.exit(result.status ?? 1);
