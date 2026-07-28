import { createRequire } from "module";

const req = createRequire(import.meta.url);
const MedusaPkg = req("@medusajs/js-sdk");

// Handle Node ESM default export quirk
const Medusa = (MedusaPkg as any).default || MedusaPkg;

// Trick Vercel's NFT tracer into including the dependency.
// This function is never called, so it doesn't crash at runtime,
// but since it's exported, esbuild won't eliminate it.
declare const require: any;
export function _vercelTraceMedusa() {
  try {
    require("@medusajs/js-sdk");
  } catch (e) {}
}

export const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY,
  maxRetries: 3,
});

export const getAdminHeaders = () => {
  let apiKey = process.env.MEDUSA_ADMIN_API_KEY;
  if (!apiKey) {
    throw new Error("MEDUSA_ADMIN_API_KEY is not set");
  }
  // Remove any surrounding quotes that dotenv might have left
  apiKey = apiKey.replace(/^["']|["']$/g, '');
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
  };
};