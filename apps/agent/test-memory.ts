import { agentMemory } from "./src/mastra/memory/memory.ts";
async function run() {
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(agentMemory)));
}
run();
