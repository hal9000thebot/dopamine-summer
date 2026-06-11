import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const releasePath = resolve("lib/release.ts");
const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;

  const [rawKey, inlineValue] = arg.slice(2).split("=");
  const value = inlineValue ?? process.argv[index + 1];
  args.set(rawKey, value);

  if (inlineValue === undefined) {
    index += 1;
  }
}

const currentSource = readFileSync(releasePath, "utf8");
const currentVersion = matchStringExport(currentSource, "APP_VERSION");
const nextVersion = args.get("version") ?? bumpDecimalVersion(currentVersion);
const note = args.get("note");
const changes = note ? [note] : getCommitChanges();
const date = formatDate(new Date());

if (!/^\d+\.\d+$/.test(nextVersion)) {
  throw new Error(`Invalid version "${nextVersion}". Use a decimal version like 1.1 or 2.0.`);
}

if (nextVersion === currentVersion) {
  throw new Error(`Version is already ${currentVersion}. Choose a new version.`);
}

const updatedSource = updateReleaseSource(currentSource, {
  changes,
  date,
  nextVersion
});

writeFileSync(releasePath, updatedSource);
console.log(`Released v${nextVersion}`);
for (const change of changes) {
  console.log(`- ${change}`);
}

function matchStringExport(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)"`));
  if (!match) {
    throw new Error(`Could not find ${name} in ${releasePath}.`);
  }

  return match[1];
}

function bumpDecimalVersion(version) {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}`;
}

function getCommitChanges() {
  const latestReleasedCommit = getLatestReleasedCommit();
  const range = latestReleasedCommit ? `${latestReleasedCommit}..HEAD` : "HEAD";
  const output = execFileSync("git", ["log", "--pretty=format:%s", range], {
    encoding: "utf8"
  }).trim();

  if (!output) {
    const status = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim();
    if (status) {
      return ["Uncommitted local changes prepared for release."];
    }

    return ["Maintenance release."];
  }

  return Array.from(new Set(output.split("\n").map(cleanCommitSubject).filter(Boolean)));
}

function getLatestReleasedCommit() {
  try {
    return execFileSync("git", ["log", "-1", "--format=%H", "--", "lib/release.ts"], {
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

function cleanCommitSubject(subject) {
  return subject.replace(/^\w+\([^)]*\):\s*/, "").replace(/^\w+:\s*/, "").trim();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function updateReleaseSource(source, { changes, date, nextVersion }) {
  const entry = `  {\n    version: "${nextVersion}",\n    date: "${date}",\n    changes: [\n${changes.map((change) => `      ${JSON.stringify(change)}`).join(",\n")}\n    ]\n  }`;

  return source
    .replace(`export const APP_VERSION = "${matchStringExport(source, "APP_VERSION")}";`, `export const APP_VERSION = "${nextVersion}";`)
    .replace("export const CHANGELOG: ChangelogEntry[] = [", `export const CHANGELOG: ChangelogEntry[] = [\n${entry},`);
}
