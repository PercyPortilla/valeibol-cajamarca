import { spawnSync } from "node:child_process";
import { runSqlTests } from "./run-supabase-sql-tests.mjs";

const supabaseBin = process.platform === "win32" ? "supabase.cmd" : "supabase";

function exec(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });

  if (result.error) {
    if (allowFailure) return false;
    throw result.error;
  }

  if (result.status !== 0) {
    if (allowFailure) return false;
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return true;
}

if (!exec("docker", ["version"], { allowFailure: true })) {
  console.error(
    "Supabase local E2E requires Docker (or another Docker-compatible runtime). " +
      "No remote Supabase project will be used as a fallback.",
  );
  process.exit(2);
}

let localDbStarted = false;

try {
  console.log("\n[sql-e2e] Starting isolated local Supabase Postgres...");
  exec(supabaseBin, ["db", "start"]);
  localDbStarted = true;

  console.log("\n[sql-e2e] Rebuilding local database from repository migrations...");
  exec(supabaseBin, ["db", "reset", "--local"]);

  runSqlTests();
} finally {
  if (localDbStarted) {
    console.log("\n[sql-e2e] Stopping local Supabase containers...");
    exec(supabaseBin, ["stop", "--no-backup"], { allowFailure: true });
  }
}
