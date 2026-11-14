import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
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

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

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
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun(output.trim());
      else rejectRun(new Error(`${command} ${args.join(" ")} failed (${code}).\n${errors || output}`));
    });
    child.stdin.end(options.input || "");
  });
}

async function compose(args, options = {}) {
  return run("docker", ["compose", ...args], options);
}

async function migrate() {
  await compose(["up", "-d", "--wait", "--wait-timeout", "60", "postgres"]);
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
    console.log(`Applied migration ${filename}`);
  }
  if (migrations.every((filename) => applied.has(filename))) console.log("Database schema is up to date.");
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
  const stdoutFD = openSync(join(logsDir, `${name}.out.log`), "a");
  const stderrFD = openSync(join(logsDir, `${name}.err.log`), "a");
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
  child.unref();
  return new Promise((resolveSpawn, rejectSpawn) => {
    child.once("error", rejectSpawn);
    child.once("spawn", () => resolveSpawn(child.pid));
  });
}

async function waitFor(url, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch { /* service is still starting */ }
    await delay(500);
  }
  throw new Error(`${label} did not become healthy within 60 seconds. Check .dev/logs.`);
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
    console.log("Development processes appear to be running already. Use npm run dev:status.");
    return;
  }

  console.log("Starting local PostgreSQL and applying migrations...");
  await migrate();

  const env = { ...process.env, DATABASE_URL: databaseURL, PORT: "8080" };
  let backendPid;
  let frontendPid;
  try {
    backendPid = await startDetached("backend", "go", ["run", "./cmd/server"], {
      cwd: join(root, "backend"), env,
    });
    saveState({ backendPid, startedAt: new Date().toISOString() });

    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    frontendPid = await startDetached("frontend", npm, [
      "run", "dev", "--workspace", "@heart-of-the-beast/frontend", "--",
      "--host", "127.0.0.1", "--port", "5173", "--strictPort",
    ], { shell: process.platform === "win32" });
    saveState({ backendPid, frontendPid, startedAt: new Date().toISOString() });

    await waitFor(backendURL, "Backend");
    await waitFor(frontendURL, "Frontend");
  } catch (error) {
    await stopProcess(backendPid);
    await stopProcess(frontendPid);
    try { await compose(["stop", "postgres"]); } catch { /* preserve original error */ }
    if (existsSync(stateFile)) unlinkSync(stateFile);
    throw error;
  }

  console.log("Development stack is ready:");
  console.log(`  Game client: ${frontendURL}`);
  console.log("  Backend:     http://127.0.0.1:8080");
  console.log("  PostgreSQL:  localhost:5432 (heart / heart)");
  console.log("Use npm run dev:down to stop the application and database.");
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
  console.log(`PostgreSQL: ${databaseRunning ? "running" : "stopped"}`);
  console.log(`Backend:    ${backendRunning && await healthy(backendURL) ? "healthy" : "stopped / unhealthy"}`);
  console.log(`Frontend:   ${frontendRunning && await healthy(frontendURL) ? "healthy" : "stopped / unhealthy"}`);
  if (state.startedAt) console.log(`Started:    ${state.startedAt}`);
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
  else if (command === "migrate") await migrate();
  else if (command === "reset") await resetDatabase();
  else {
    console.log("Usage: node scripts/dev.mjs <up|down|status|migrate|reset>");
    process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
