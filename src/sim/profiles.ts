// Per-component-type tuning knobs for the call-based engine. The runner wires
// these in; the engine itself just takes whatever `variance` a NodeInit gives it.

const DATASTORE_IDS = new Set([
  "sql-db", "nosql-db", "object-store", "data-warehouse", "vector-db",
]);
const CACHE_EDGE_IDS = new Set([
  "cache", "cdn", "dns", "load-balancer", "waf", "api-gateway", "ingress",
]);
const EXTERNAL_IDS = new Set(["third-party-api", "payment", "email", "llm-gateway"]);
const COMPUTE_IDS = new Set([
  "app-server", "worker", "serverless", "auth-service", "search", "scheduler",
  "notifications", "analytics", "orchestrator", "tool-registry", "memory-fabric",
  "safety-mesh",
]);

/** Lognormal sigma for local service-time jitter, by component category. */
export function varianceFor(componentId: string): number {
  if (DATASTORE_IDS.has(componentId)) return 0.5;
  if (COMPUTE_IDS.has(componentId)) return 0.4;
  if (CACHE_EDGE_IDS.has(componentId)) return 0.25;
  if (EXTERNAL_IDS.has(componentId)) return 0.6;
  return 0.4;
}
