import pkg from "../package.json";

export function getVersionInfo() {
  return {
    version: pkg.version,
    commit: process.env.GIT_COMMIT ?? "unknown",
    buildDate: process.env.BUILD_DATE ?? "unknown"
  };
}
