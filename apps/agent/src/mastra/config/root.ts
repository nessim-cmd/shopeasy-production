// src/mastra/config/root.ts
import path from "path";
import { existsSync } from "fs";

// Inside Docker the workdir is always /app (set in Dockerfile).
// Outside Docker we walk up from cwd() to find package.json.
const isDocker = existsSync("/.dockerenv");

function findRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

export const PROJECT_ROOT: string = isDocker
  ? "/workspace/apps/agent"
  : findRoot(process.cwd());

console.log(
  `[root] PROJECT_ROOT = ${PROJECT_ROOT} (source: ${isDocker ? "docker hardcode" : "cwd walk"})`,
);