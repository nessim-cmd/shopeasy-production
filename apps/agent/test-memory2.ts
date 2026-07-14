import { agentMemory } from "./src/mastra/memory/memory.ts";
async function run() {
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(agentMemory)).filter(k => k.toLowerCase().includes('message')));
}
run();
