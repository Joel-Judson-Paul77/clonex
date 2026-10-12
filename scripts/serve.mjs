// Production server with automatic restart, for demos.
// Usage: npm run demo   (builds, then runs this)
//
// The dev server has crashed intermittently with a native heap-corruption error (0xC0000374) that we
// could not reproduce on demand. The production server is more stable, and this supervisor makes sure
// that if it ever exits unexpectedly it comes straight back, logging the exit code for diagnosis.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.PORT ?? "3000";

const MAX_RESTARTS = 5; // within WINDOW_MS; more than that means something is really broken
const WINDOW_MS = 60_000;
let restarts = [];
let child = null;
let stopping = false;

function start() {
  console.log(`[serve] starting CloneX on http://localhost:${port}`);
  child = spawn(process.execPath, [nextBin, "start", "-p", port], { stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    const hex = typeof code === "number" ? ` (0x${(code >>> 0).toString(16).toUpperCase()})` : "";
    console.error(`[serve] server exited with code ${code}${hex}${signal ? `, signal ${signal}` : ""}`);
    const now = Date.now();
    restarts = restarts.filter((t) => now - t < WINDOW_MS);
    if (restarts.length >= MAX_RESTARTS) {
      console.error(`[serve] ${MAX_RESTARTS} crashes within ${WINDOW_MS / 1000}s; giving up. Check the log above.`);
      process.exit(1);
    }
    restarts.push(now);
    const delay = 1000 * restarts.length; // back off a little more after each crash
    console.error(`[serve] restarting in ${delay / 1000}s...`);
    setTimeout(start, delay);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopping = true;
    child?.kill(sig);
    process.exit(0);
  });
}

start();
