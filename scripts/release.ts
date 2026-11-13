import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";

const USAGE =
  'usage: bun scripts/release.ts <ref> <version> (--level hotfix|full | --auto-level) [--title "..."] [--change new|improved|fixed:"..."]... [--all-tests] [--dir <path>]';

const Level = { HOTFIX: "hotfix", FULL: "full" } as const;
type Level = (typeof Level)[keyof typeof Level];

const KINDS = { new: "NEW", improved: "IMPROVED", fixed: "FIXED" } as const;
type Kind = keyof typeof KINDS;

const FULL_PATHS = ["src/worldgen/", "src/world/", "src/car/", "scripts/golden"];
const VERSION_TEST = "src/version.test.ts";

interface Args {
  ref: string;
  version: string;
  level: Level | null;
  auto_level: boolean;
  all_tests: boolean;
  title: string;
  changes: { kind: Kind; text: string }[];
  dir: string | null;
}

interface StepResult {
  name: string;
  ok: boolean;
  secs: number;
  output: string;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parse_args(argv: string[]): Args {
  const positional: string[] = [];
  const args: Args = { ref: "", version: "", level: null, auto_level: false, all_tests: false, title: "Fixes", changes: [], dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => argv[++i] ?? fail(`${a} needs a value\n${USAGE}`);
    if (a === "--level") {
      const level = value();
      if (level !== Level.HOTFIX && level !== Level.FULL) fail(`--level is hotfix or full, got ${level}`);
      args.level = level;
    } else if (a === "--auto-level") args.auto_level = true;
    else if (a === "--all-tests") args.all_tests = true;
    else if (a === "--title") args.title = value();
    else if (a === "--dir") args.dir = resolve(value());
    else if (a === "--change") {
      const raw = value();
      const at = raw.indexOf(":");
      const kind = raw.slice(0, at) as Kind;
      const text = raw.slice(at + 1).trim();
      if (at < 0 || !(kind in KINDS) || !text) fail(`--change is new|improved|fixed:"text", got ${raw}`);
      args.changes.push({ kind, text });
    } else if (a.startsWith("--")) fail(`unknown flag ${a}\n${USAGE}`);
    else positional.push(a);
  }
  if (positional.length !== 2) fail(USAGE);
  [args.ref, args.version] = positional;
  if (!/^\d+\.\d+\.\d+$/.test(args.version)) fail(`version must be x.y.z, got ${args.version}`);
  if ((args.level === null) === !args.auto_level) fail(`pass one of --level or --auto-level\n${USAGE}`);
  if (!args.changes.length) fail("pass at least one --change: the changelog test needs one per release");
  return args;
}

function git(cwd: string, ...cmd: string[]): string {
  const run = Bun.spawnSync(["git", ...cmd], { cwd, stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) fail(`git ${cmd.join(" ")} failed:\n${run.stderr.toString()}`);
  return run.stdout.toString().trim();
}

function git_try(cwd: string, ...cmd: string[]): string | null {
  const run = Bun.spawnSync(["git", ...cmd], { cwd, stdout: "pipe", stderr: "pipe" });
  return run.exitCode === 0 ? run.stdout.toString().trim() : null;
}

function compare_versions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function last_release(cwd: string, ref: string): string | null {
  const tag = git_try(cwd, "describe", "--tags", "--abbrev=0", ref);
  const commit = git_try(cwd, "log", "-1", "--format=%H", "--grep=^chore: release ", ref) || null;
  const tag_sha = tag ? git(cwd, "rev-list", "-n", "1", tag) : null;
  if (!tag_sha) return commit;
  if (!commit) return tag_sha;
  return git_try(cwd, "merge-base", "--is-ancestor", tag_sha, commit) !== null ? commit : tag_sha;
}

function changed_since(cwd: string, ref: string): { base: string | null; files: string[] } {
  const base = last_release(cwd, ref);
  return { base, files: base ? git(cwd, "diff", "--name-only", base, ref).split("\n").filter(Boolean) : [] };
}

function pick_tests(cwd: string, changed: string[]): string[] {
  const changed_set = new Set(changed);
  const folders = new Set(changed.map((f) => posix.dirname(f)));
  const imports = (test: string) =>
    [...readFileSync(join(cwd, test), "utf8").matchAll(/(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["']/g)].map((m) => posix.join(posix.dirname(test), m[1]));
  const hits = (module: string) => ["", ".ts", ".svelte.ts", "/index.ts"].some((ext) => changed_set.has(module + ext));
  const picked = git(cwd, "ls-files", "*.test.ts")
    .split("\n")
    .filter(Boolean)
    .filter((test) => folders.has(posix.dirname(test)) || imports(test).some(hits));
  return [...new Set([VERSION_TEST, ...picked])].sort();
}

function bump_package(dir: string, version: string): string {
  const path = join(dir, "package.json");
  const text = readFileSync(path, "utf8");
  const current = text.match(/"version":\s*"([^"]+)"/)?.[1] ?? fail("package.json has no version");
  if (compare_versions(version, current) <= 0) fail(`version ${version} is not past ${current}`);
  writeFileSync(path, text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
  return current;
}

function prepend_changelog(dir: string, args: Args): void {
  const path = join(dir, "src", "changelog.ts");
  const text = readFileSync(path, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const anchor = `export const CHANGELOG: Release[] = [${eol}`;
  const at = text.indexOf(anchor);
  if (at < 0) fail("src/changelog.ts: no `export const CHANGELOG: Release[] = [` line");
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const entry = [
    "  {",
    `    version: ${JSON.stringify(args.version)},`,
    `    date: "${date}",`,
    `    title: ${JSON.stringify(args.title)},`,
    "    changes: [",
    ...args.changes.map((c) => `      { kind: ${KINDS[c.kind]}, text: ${JSON.stringify(c.text)} },`),
    "    ],",
    "  },",
  ].join(eol);
  const cut = at + anchor.length;
  writeFileSync(path, text.slice(0, cut) + entry + eol + text.slice(cut));
}

async function step(name: string, cmd: string[], cwd: string, env: Record<string, string> = {}): Promise<StepResult> {
  const t0 = performance.now();
  const proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  const result = { name, ok: code === 0, secs: (performance.now() - t0) / 1000, output: out + err };
  console.log(`${result.ok ? "ok  " : "FAIL"} ${name} (${result.secs.toFixed(1)} s)`);
  return result;
}

function tail(output: string, lines = 40): string {
  return output.trimEnd().split(/\r?\n/).slice(-lines).join("\n");
}

const args = parse_args(process.argv.slice(2));
const source = resolve(import.meta.dir, "..");
const t_start = performance.now();
const timings: StepResult[] = [];

const sha = git_try(source, "rev-parse", "--verify", `${args.ref}^{commit}`) ?? fail(`unknown ref ${args.ref}`);
const dir = args.dir ?? join(tmpdir(), `harepin-release-${args.version}-${Date.now()}`);
if (existsSync(dir) && readdirSync(dir).length) fail(`${dir} is not empty`);
mkdirSync(dir, { recursive: true });

let t = performance.now();
git(source, "clone", "--quiet", "--no-checkout", source, dir);
if (git_try(dir, "cat-file", "-e", `${sha}^{commit}`) === null) git(dir, "fetch", "--quiet", "origin", sha);
git(dir, "checkout", "--quiet", "-b", "rel", sha);
timings.push({ name: "clone", ok: true, secs: (performance.now() - t) / 1000, output: "" });

const since = changed_since(dir, sha);
const world_hits = since.files.filter((f) => FULL_PATHS.some((p) => f.startsWith(p)));
const world_changed = !since.base || world_hits.length > 0;
let level = args.level ?? Level.HOTFIX;
if (args.auto_level) {
  level = world_changed ? Level.FULL : Level.HOTFIX;
  const why = !since.base ? "no earlier release" : world_hits.length ? `touches ${world_hits.slice(0, 5).join(", ")}${world_hits.length > 5 ? ` and ${world_hits.length - 5} more` : ""}` : "no world, car or golden change";
  console.log(`auto level: ${level} (since ${since.base?.slice(0, 7) ?? "the start"}: ${why})`);
}
const all_tests = args.all_tests || !since.base;
const tests = all_tests ? [] : pick_tests(dir, since.files);
console.log(
  all_tests
    ? `tests: the whole suite (${args.all_tests ? "--all-tests" : "no earlier release"})`
    : `tests: ${tests.length} files for ${since.files.length} changed since ${since.base?.slice(0, 7)}\n${tests.map((f) => `  ${f}`).join("\n")}`,
);

t = performance.now();
const previous = bump_package(dir, args.version);
prepend_changelog(dir, args);
for (const key of ["user.name", "user.email"]) {
  const value = git_try(source, "config", key);
  if (value) git(dir, "config", key, value);
}
git(dir, "add", "package.json", "src/changelog.ts");
git(dir, "-c", "core.hooksPath=", "commit", "--quiet", "--no-verify", "-m", `chore: release ${args.version}`);
const release_sha = git(dir, "rev-parse", "HEAD");
timings.push({ name: "bump + commit", ok: true, secs: (performance.now() - t) / 1000, output: "" });
console.log(`${previous} -> ${args.version} at ${sha.slice(0, 7)}, level ${level}, in ${dir}`);

const installs = await Promise.all([
  step("bun install", ["bun", "install", "--frozen-lockfile"], dir),
  step("bun install (svelte-check)", ["bun", "install", "--frozen-lockfile"], join(dir, "tools", "svelte-check")),
]);
timings.push(...installs);

if (installs.every((r) => r.ok)) {
  const builds = [
    step("tsc --noEmit", ["bun", "run", "typecheck"], dir),
    step("check:svelte", ["bun", "run", "check:svelte"], dir),
    step("vite build", ["bun", "run", "build"], dir),
  ];
  const checks: Promise<StepResult>[] = [...builds];
  // Several car and audio tests take 3-4 s alone; next to the builds they pass bun's 5 s default and fail as timeouts.
  const test_cmd = ["bun", "test", "--timeout", "60000", ...tests.map((f) => `./${f}`)];
  const test_name = all_tests ? "bun test (all)" : `bun test (${tests.length} files)`;
  if (level === Level.FULL) {
    if (world_changed) {
      checks.push(step("golden --check", ["bun", "scripts/golden.ts", "--check"], dir));
      checks.push(step("proof --jobs 3", ["bun", "scripts/proof.ts", "--jobs", "3"], dir));
    } else console.log("golden and proof skipped: no world, car or golden change");
    checks.push(Promise.all(builds).then(() => step(`FULL=1 ${test_name}`, test_cmd, dir, { FULL: "1" })));
  } else checks.push(step(test_name, test_cmd, dir));
  timings.push(...(await Promise.all(checks)));
}

const failed = timings.filter((r) => !r.ok);
for (const r of failed) {
  const fails = r.output.split(/\r?\n/).filter((line) => line.startsWith("(fail)"));
  console.log(`\n--- ${r.name} (last 40 lines) ---\n${fails.length ? `${fails.join("\n")}\n...\n` : ""}${tail(r.output)}`);
}

const width = Math.max(...timings.map((r) => r.name.length));
console.log(`\n${"step".padEnd(width)}  result   secs`);
for (const r of timings) console.log(`${r.name.padEnd(width)}  ${r.ok ? "ok  " : "FAIL"}  ${r.secs.toFixed(1).padStart(6)}`);
console.log(`${"total".padEnd(width)}  ${failed.length ? "FAIL" : "ok  "}  ${((performance.now() - t_start) / 1000).toFixed(1).padStart(6)}`);
console.log(`\nlevel:   ${level}\nclone:   ${dir}\nrelease: ${release_sha} (branch rel, not pushed)`);
process.exit(failed.length ? 1 : 0);
