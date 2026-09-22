import { getVersionInfo } from "../lib/version";

export function VersionFooter() {
  const { version, commit, buildDate } = getVersionInfo();
  const builtLabel =
    buildDate === "unknown" ? null : new Date(buildDate).toLocaleDateString();

  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-center text-xs text-muted-foreground">
      ApexPulse v{version}
      {commit !== "unknown" && <> &middot; {commit}</>}
      {builtLabel && <> &middot; built {builtLabel}</>}
    </footer>
  );
}
