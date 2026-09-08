import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const PORT = process.env.PORT || "3305";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const children = new Map();
let shuttingDown = false;

function startProcess(name, args, env = {}) {
  const child = spawn(pnpm, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

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

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("system", "shutting down...");

  for (const child of children.values()) {
    if (!child.killed) child.kill("SIGTERM");
  }

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
