/**
 * Root package preinstall: drop other lockfiles and require pnpm.
 * Runs on Windows without a POSIX shell (replaces `sh -c '...'`).
 */
const fs = require("fs");

for (const name of ["package-lock.json", "yarn.lock"]) {
  try {
    if (fs.existsSync(name)) fs.unlinkSync(name);
  } catch {
    /* ignore */
  }
}

const ua = process.env.npm_config_user_agent || "";
if (!ua.includes("pnpm")) {
  console.error("This workspace must be installed with pnpm (not npm or yarn).");
  process.exit(1);
}
