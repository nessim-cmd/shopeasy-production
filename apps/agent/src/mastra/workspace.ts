// src/mastra/workspace.ts
import { Workspace, LocalFilesystem } from "@mastra/core/workspace";
import path from "path";
import { PROJECT_ROOT } from "./config/root.js";

const skillsPath = path.join(PROJECT_ROOT, "src/mastra/workspace/skills");

console.log("[Workspace] Project root:", PROJECT_ROOT);
console.log("[Workspace] Skills path:", skillsPath);

export const shopWorkspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: PROJECT_ROOT }),
  skills: [skillsPath],
});
