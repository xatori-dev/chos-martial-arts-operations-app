import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function gitValue(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const version = process.env.GITHUB_SHA || gitValue(["rev-parse", "HEAD"]) || "local";
const branch = process.env.GITHUB_REF_NAME || gitValue(["branch", "--show-current"]) || "local";
const outputPath = resolve("dist", "app-version.json");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      version,
      branch,
      builtAt: new Date().toISOString()
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${outputPath} for ${version}.`);
