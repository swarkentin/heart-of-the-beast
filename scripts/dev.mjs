import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = join(root, ".dev");
const stateFile = join(stateDir, "processes.json");
const logsDir = join(stateDir, "logs");
const databaseURL = "postgres://heart:heart@localhost:5432/heart_of_the_beast?sslmode=disable";
const backendURL = "http://127.0.0.1:8080/healthz";
const frontendURL = "http://127.0.0.1:5173/";

const binDir = join(stateDir, "bin");
const backendBinary = join(binDir, process.platform === "win32" ? "server.exe" : "server");
const viteEntry = join(root, "node_modules", "vite", "bin", "vite.js");
const verbose = process.argv.includes("--verbose") || process.env.DEV_VERBOSE === "1";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const elapsed = (since) => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const exits = new Map(); // pid -> { code, signal } for detached children that have exited

// Prints a progress line every few seconds while a long task runs, so a quiet
// step never looks like a hang.
function heartbeat(label, intervalMs = 5000) {
  const began = Date.now();
  const timer = setInterval(() => console.log(`      ... ${label} (${Math.round((Date.now() - began) / 1000)}s)`), intervalMs);
  return () => clearInterval(timer);
}

let stepNumber = 0;
let stepTotal = 0;
async function step(label, action) {
  stepNumber += 1;
  const prefix = `[${stepNumber}/${stepTotal}]`;
  const began = Date.now();
  console.log(`${prefix} ${label}`);
  try {
    const result = await action();
    console.log(`      done in ${elapsed(began)}`);
    return result;
  } catch (error) {
    console.error(`      FAILED after ${elapsed(began)}`);
    throw error;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: options.env || process.env,
      shell: options.shell || false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    const stopHeartbeat = options.heartbeat ? heartbeat(options.heartbeat) : () => {};
    const timeout = options.timeoutMs ? setTimeout(() => child.kill(), options.timeoutMs) : null;
    child.stdout.on("data", (chunk) => { output += chunk; options.onOutput?.(String(chunk)); });
    child.stderr.on("data", (chunk) => { errors += chunk; options.onOutput?.(String(chunk)); });
    child.on("error", (error) => { stopHeartbeat(); clearTimeout(timeout); rejectRun(error); });
    child.on("close", (code) => {
      stopHeartbeat();
      clearTimeout(timeout);
      if (code === 0) resolveRun(output.trim());
      else rejectRun(new Error(`${command} ${args.join(" ")} failed (${code}).\n${errors || output}`));
    });
    // A command that exits before reading stdin makes this write fail with EPIPE;
    // without a handler that unhandled error crashes the whole script.
    child.stdin.on("error", () => {});
    child.stdin.end(options.input || "");
  });
}

async function compose(args, options = {}) {
  return run("docker", ["compose", ...args], options);
}

async function startPostgres() {
  try {
    await compose(["up", "-d", "--wait", "--wait-timeout", "60", "postgres"], { heartbeat: "waiting for PostgreSQL container to become healthy", timeoutMs: 180000 });
  } catch (error) {
    throw new Error(`Could not start PostgreSQL.\n${error.message}`);
  }
}

async function applyMigrations() {
  const psql = ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "heart", "-d", "heart_of_the_beast"];
  await run("docker", [...psql, "-c", "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"]);
  const appliedOutput = await run("docker", [...psql, "-At", "-c", "SELECT version FROM schema_migrations ORDER BY version;"]);
  const applied = new Set(appliedOutput.split(/\r?\n/).filter(Boolean));
  const migrationDir = join(root, "backend", "migrations");
  const migrations = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();

  for (const filename of migrations) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(join(migrationDir, filename), "utf8");
    const version = filename.replaceAll("'", "''");
    await run("docker", [...psql], {
      input: `BEGIN;\n${sql}\nINSERT INTO schema_migrations (version) VALUES ('${version}');\nCOMMIT;\n`,
    });
    console.log(`      Applied migration ${filename}`);
  }
  if (migrations.every((filename) => applied.has(filename))) console.log(`      Database schema is up to date (${migrations.length} migrations).`);
}

async function migrate() {
  await startPostgres();
  await applyMigrations();
}

function readState() {
  if (!existsSync(stateFile)) return {};
  try { return JSON.parse(readFileSync(stateFile, "utf8")); }
  catch { return {}; }
}

function saveState(state) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

async function startDetached(name, command, args, options = {}) {
  mkdirSync(logsDir, { recursive: true });
  // Truncate on every start so a failure never shows output from an earlier run.
  const stdoutFD = openSync(join(logsDir, `${name}.out.log`), "w");
  const stderrFD = openSync(join(logsDir, `${name}.err.log`), "w");
  const child = spawn(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    detached: true,
    shell: options.shell || false,
    windowsHide: true,
    stdio: ["ignore", stdoutFD, stderrFD],
  });
  closeSync(stdoutFD);
  closeSync(stderrFD);
  child.once("exit", (code, signal) => { if (child.pid) exits.set(child.pid, { code, signal }); });
  child.unref();
  return new Promise((resolveSpawn, rejectSpawn) => {
    child.once("error", rejectSpawn);
    child.once("spawn", () => resolveSpawn(child.pid));
  });
}

function logPath(name, stream) {
  return join(logsDir, `${name}.${stream}.log`);
}

function logTail(name, lines = 25) {
  const parts = [];
  for (const stream of ["err", "out"]) {
    const file = logPath(name, stream);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8").trimEnd();
    if (!content) continue;
    parts.push(`--- last output of ${file} ---\n${content.split(/\r?\n/).slice(-lines).join("\n")}`);
  }
  return parts.length ? parts.join("\n") : `(no output was written to ${logsDir})`;
}

// Prints new lines appended to a service log, so startup output is visible live.
function followLog(name, stream) {
  const file = logPath(name, stream);
  let offset = 0;
  let partial = "";
  return () => {
    if (!existsSync(file)) return;
    const size = statSync(file).size;
    if (size <= offset) return;
    const fd = openSync(file, "r");
    const buffer = Buffer.alloc(size - offset);
    readSync(fd, buffer, 0, buffer.length, offset);
    closeSync(fd);
    offset = size;
    const lines = (partial + buffer.toString("utf8")).split(/\r?\n/);
    partial = lines.pop();
    for (const line of lines) {
      const clean = line.replace(/\u001b\[[0-9;]*m/g, "").trimEnd();
      if (clean) console.log(`      ${name} | ${clean}`);
    }
  };
}

function portInUse(port) {
  return new Promise((resolvePort) => {
    const probe = createServer();
    probe.once("error", (error) => resolvePort(error.code === "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolvePort(false)));
    probe.listen(port, "127.0.0.1");
  });
}

// Waits for a service to answer its health URL. Fails fast, with the service's
// own log output, if its process exits first instead of polling until timeout.
async function waitForService({ name, label, url, pid, timeoutMs = 90000 }) {
  const began = Date.now();
  const followers = [followLog(name, "out"), followLog(name, "err")];
  let lastBeat = began;
  while (Date.now() - began < timeoutMs) {
    followers.forEach((flush) => flush());
    const exit = exits.get(pid);
    if (exit) {
      followers.forEach((flush) => flush());
      const how = exit.signal ? `signal ${exit.signal}` : `exit code ${exit.code}`;
      throw new Error(`${label} stopped unexpectedly (${how}) before it became healthy.\n${logTail(name)}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { followers.forEach((flush) => flush()); console.log(`      ${label} is healthy at ${url}`); return; }
    } catch { /* service is still starting */ }
    if (Date.now() - lastBeat >= 5000) {
      lastBeat = Date.now();
      console.log(`      ... waiting for ${label} at ${url} (${Math.round((Date.now() - began) / 1000)}s, process still running)`);
    }
    await delay(400);
  }
  throw new Error(`${label} is running but did not answer ${url} within ${timeoutMs / 1000}s.\n${logTail(name)}`);
}

async function preflight() {
  const problems = [];
  try {
    const version = await run("docker", ["info", "--format", "{{.ServerVersion}}"], { timeoutMs: 20000 });
    console.log(`      Docker engine ${version}`);
  } catch (error) {
    problems.push(error.code === "ENOENT"
      ? "Docker is not installed or not on PATH."
      : "Docker is installed but its engine is not responding. Start Docker Desktop and wait until it reports running.");
  }
  try { console.log(`      ${await run("go", ["version"], { timeoutMs: 20000 })}`); }
  catch { problems.push("Go is not installed or not on PATH (Go 1.25+ is required)."); }
  console.log(`      Node ${process.version}`);
  if (!existsSync(viteEntry)) problems.push("Frontend dependencies are missing. Run `npm install` in the repository root.");
  for (const [label, port] of [["Backend", 8080], ["Frontend", 5173]]) {
    if (await portInUse(port)) problems.push(`Port ${port} (${label}) is already in use by another process. Run \`npm run dev:down\`, or stop whatever is using that port.`);
  }
  if (problems.length) throw new Error(`Cannot start yet:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
}

async function buildBackend() {
  mkdirSync(binDir, { recursive: true });
  const args = ["build", ...(verbose ? ["-v"] : []), "-o", backendBinary, "./cmd/server"];
  console.log(`      go ${args.join(" ")}${verbose ? "" : "  (first build downloads/compiles dependencies and can take a few minutes)"}`);
  try {
    await run("go", args, {
      cwd: join(root, "backend"),
      heartbeat: "compiling backend",
      timeoutMs: 600000,
      onOutput: verbose ? (text) => text.split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`      go | ${line}`)) : undefined,
    });
  } catch (error) {
    throw new Error(`Backend build failed.\n${error.message}`);
  }
}

async function isRunning(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

async function stopProcess(pid) {
  if (!(await isRunning(pid))) return;
  if (process.platform === "win32") {
    try { await run("taskkill", ["/PID", String(pid), "/T", "/F"]); }
    catch { /* process may have exited */ }
  } else {
    try { process.kill(-pid, "SIGTERM"); }
    catch { try { process.kill(pid, "SIGTERM"); } catch { /* already stopped */ } }
  }
}

async function up() {
  const previous = readState();
  if ((previous.backendPid && await isRunning(previous.backendPid)) ||
      (previous.frontendPid && await isRunning(previous.frontendPid))) {
    console.log("Development processes from an earlier run are still alive:");
    await status();
    console.log("");
    console.log("Run `npm run dev:down` first if you want a clean restart.");
    return;
  }

  const began = Date.now();
  stepTotal = 6;
  console.log("Starting the Heart of the Beast development stack" + (verbose ? " (verbose)" : "") + "\n");

  await step("Checking prerequisites (Docker, Go, Node, dependencies, free ports)", preflight);
  await step("Starting PostgreSQL", startPostgres);
  await step("Applying database migrations", applyMigrations);

  const env = { ...process.env, DATABASE_URL: databaseURL, PORT: "8080" };
  let backendPid;
  let frontendPid;
  try {
    await step("Building backend (go build)", buildBackend);

    await step("Starting backend and waiting for /healthz", async () => {
      backendPid = await startDetached("backend", backendBinary, [], { cwd: join(root, "backend"), env });
      saveState({ backendPid, startedAt: new Date().toISOString() });
      console.log(`      backend pid ${backendPid}, logs in ${logsDir}`);
      await waitForService({ name: "backend", label: "Backend", url: backendURL, pid: backendPid });
    });

    await step("Starting frontend (Vite) and waiting for it to serve", async () => {
      // Launch Vite through the current Node executable instead of npm.cmd.
      // On Windows, wrapping npm.cmd in another shell can create visible/repeated
      // cmd.exe windows and makes detached-process cleanup unreliable.
      frontendPid = await startDetached("frontend", process.execPath, [
        viteEntry, "--host", "127.0.0.1", "--port", "5173", "--strictPort",
      ], { cwd: join(root, "frontend") });
      saveState({ backendPid, frontendPid, startedAt: new Date().toISOString() });
      console.log(`      frontend pid ${frontendPid}, logs in ${logsDir}`);
      await waitForService({ name: "frontend", label: "Frontend", url: frontendURL, pid: frontendPid });
    });
  } catch (error) {
    console.error("\nStartup failed; stopping anything that was started.");
    await stopProcess(backendPid);
    await stopProcess(frontendPid);
    try { await compose(["stop", "postgres"]); } catch { /* preserve original error */ }
    if (existsSync(stateFile)) unlinkSync(stateFile);
    throw error;
  }

  console.log("");
  console.log(`Heart of the Beast is ready! (total ${elapsed(began)})`);
  console.log("");
  console.log("Open the game in your browser:");
  console.log(`  Player view:     ${frontendURL.replace("127.0.0.1", "localhost")}`);
  console.log("");
  console.log("Local services:");
  console.log("  Frontend:        http://localhost:5173 (Vite)");
  console.log("  Backend health:  http://localhost:8080/healthz");
  console.log("  PostgreSQL:      localhost:5432 (database: heart_of_the_beast)");
  console.log("");
  console.log("Useful commands:");
  console.log("  npm run dev:status  Check service health");
  console.log("  npm run dev:down    Stop the app and database");
  console.log("  npm run db:reset    Recreate the local database (destructive)");
}

async function down() {
  const state = readState();
  await stopProcess(state.frontendPid);
  await stopProcess(state.backendPid);
  if (existsSync(stateFile)) unlinkSync(stateFile);
  try { await compose(["stop", "postgres"]); }
  catch (error) { console.warn(`Could not stop PostgreSQL: ${error.message}`); }
  console.log("Development stack stopped. Database volume was preserved.");
}

async function status() {
  const state = readState();
  const backendRunning = await isRunning(state.backendPid);
  const frontendRunning = await isRunning(state.frontendPid);
  let databaseRunning = false;
  try {
    const services = await compose(["ps", "--services", "--filter", "status=running"]);
    databaseRunning = services.split(/\r?\n/).includes("postgres");
  } catch { /* Docker may not be installed or running */ }
  const healthy = async (url) => {
    try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  };
  const backendHealthy = backendRunning && await healthy(backendURL);
  const frontendHealthy = frontendRunning && await healthy(frontendURL);
  console.log(`PostgreSQL: ${databaseRunning ? "running" : "stopped"}`);
  console.log(`Backend:    ${backendHealthy ? "healthy" : "stopped / unhealthy"}`);
  console.log(`Frontend:   ${frontendHealthy ? "healthy" : "stopped / unhealthy"}`);
  if (state.startedAt) console.log(`Started:    ${state.startedAt}`);
  if (!databaseRunning || !backendHealthy || !frontendHealthy) process.exitCode = 1;
}

async function resetDatabase() {
  if (!process.argv.slice(3).includes("--yes")) {
    const prompt = createInterface({ input: stdin, output: stdout });
    const answer = await prompt.question("This permanently deletes the local development database volume. Continue? (y/N) ");
    prompt.close();
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("Database reset cancelled.");
      return;
    }
  }
  await down();
  await compose(["down", "-v"]);
  await migrate();
  console.log("Local database reset and migrations applied.");
}

const command = process.argv[2] || "help";
try {
  if (command === "up") await up();
  else if (command === "down") await down();
  else if (command === "status") await status();
  else if (command === "migrate") { stepTotal = 2; await step("Starting PostgreSQL", startPostgres); await step("Applying database migrations", applyMigrations); }
  else if (command === "reset") await resetDatabase();
  else {
    console.log("Usage: node scripts/dev.mjs <up|down|status|migrate|reset> [--verbose]");
    process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
