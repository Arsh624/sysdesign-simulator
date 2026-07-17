export type Category =
  | "Client" | "Traffic & Edge" | "Compute" | "Storage"
  | "Messaging" | "Observability" | "Network" | "AI & Agents" | "External";

export interface SimDefaults {
  serviceTimeMs: number;   // time to process one request
  concurrency: number;     // requests processed in parallel
  capacity: number;        // max queued before dropping
  failureRate: number;     // 0..1 probability a request fails at this node
}

export interface ComponentDef {
  id: string;
  name: string;
  category: Category;
  icon: string;            // emoji or short label for v1
  defaults: SimDefaults;
  isSource?: boolean;      // generates traffic
  isSink?: boolean;        // terminates a request (records latency)
}
