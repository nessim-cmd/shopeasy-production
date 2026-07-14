import { agentMemory } from "./src/mastra/memory/memory.js";

async function run() {
  const store = await agentMemory.getMemoryStore();
  console.log("Memory methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(agentMemory)));
  console.log("Store methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(store)));
  
  // Test getting messages
  if (typeof store.getMessages === "function") {
    console.log("Store HAS getMessages");
  } else {
    console.log("Store DOES NOT have getMessages");
  }
}
run();
