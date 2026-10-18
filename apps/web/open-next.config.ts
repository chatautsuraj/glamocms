// OpenNext adapter config for Cloudflare Workers (mirrors glamo-nepal).
// GLAMO POS renders client-side against api.glamonepal.com and uses no ISR,
// so the default (in-memory) incremental cache is sufficient — no KV bindings.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
