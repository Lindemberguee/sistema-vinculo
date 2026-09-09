import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const PORT = process.env.PORT || "3305";
const isWin = process.platform === "win32";

// Invoke pnpm as `node <pnpm-cli.js> …` rather than `pnpm.cmd …`. Spawning a
// .cmd directly is rejected on Node >=18.20.2 on Windows (CVE-2024-27980), and
// going through a shell leaves orphaned `next`/`node` grandchildren that hold
// the port. `npm_execpath` is pnpm's own JS entry (set because this script runs
// via `pnpm start:prod`).
const pnpmCli = process.env.npm_execpath;
const [cmd, baseArgs] = pnpmCli
  ? [process.execPath, [pnpmCli]]
  : [isWin ? "pnpm.cmd" : "pnpm", []];

const children = new Map();
let shuttingDown = false;

function startProcess(name, args, env = {}) {
  const useShell = !pnpmCli && isWin;
  const child = spawn(
    useShell ? [cmd, ...baseArgs, ...args].join(" ") : cmd,
    useShell ? undefined : [...baseArgs, ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: useShell,
    },
  );

  children.set(name, child);
  prefixLines(name, child.stdout);
  prefixLines(name, child.stderr);

  child.on("spawn", () => {
    log("system", `${name} started with pid ${child.pid}`);
  });

  child.on("error", (err) => {
    log("system", `${name} failed to start: ${err.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(name);
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    log("system", `${name} stopped (${reason})`);
    if (!shuttingDown) shutdown(code && code > 0 ? code : 1);
  });

  return child;
}

function prefixLines(name, stream) {
  const rl = createInterface({ input: stream });
  rl.on("line", (line) => log(name, line));
}

function log(name, message) {
  const timestamp = new Date().toISOString();
  process.stdout.write(`${timestamp} [${name}] ${message}\n`);
}

/** Kill a child and its whole tree — Windows has no process groups, so a plain
 *  child.kill() leaves `next`/`node` grandchildren running (and holding the port). */
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (isWin && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("system", "shutting down...");

  for (const child of children.values()) killTree(child);

  const forceTimer = setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) child.kill("SIGKILL");
    }
    process.exit(code);
  }, 10_000);
  forceTimer.unref();

  if (children.size === 0) process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (err) => {
  log("system", `uncaught exception: ${err.stack || err.message}`);
  shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  log("system", `unhandled rejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
  shutdown(1);
});

log("system", `starting production stack on port ${PORT}`);
startProcess("web", ["--filter", "@donation/web", "start"], { PORT });
startProcess("worker", ["--filter", "@donation/worker", "start"]);
