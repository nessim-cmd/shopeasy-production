import { mastra } from "./src/mastra/index.js";

async function testAgent() {
  const agent = mastra.getAgent("supportAgent");
  const result = await agent.generate([
    { role: "user", content: "give me the order ORD-001" }
  ]);
  console.log(JSON.stringify(result, null, 2));
}

testAgent().catch(console.error);
