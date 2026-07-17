import type { ComponentDef } from "./types";

export const CATALOG: ComponentDef[] = [
  // --- Client ---
  {
    id: "client",
    name: "Client",
    category: "Client",
    icon: "🖥️", // 🖥️
    defaults: { serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0 },
    isSource: true,
    isSink: true,
  },
  {
    id: "mobile",
    name: "Mobile",
    category: "Client",
    icon: "📱", // 📱
    defaults: { serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0 },
    isSource: true,
    isSink: true,
  },

  // --- Traffic & Edge ---
  {
    id: "dns",
    name: "DNS",
    category: "Traffic & Edge",
    icon: "📛", // 📛
    defaults: { serviceTimeMs: 1, concurrency: 500, capacity: 10000, failureRate: 0 },
  },
  {
    id: "cdn",
    name: "CDN",
    category: "Traffic & Edge",
    icon: "🌐", // 🌐
    defaults: { serviceTimeMs: 2, concurrency: 500, capacity: 20000, failureRate: 0 },
  },
  {
    id: "load-balancer",
    name: "Load Balancer",
    category: "Traffic & Edge",
    icon: "⚖️", // ⚖️
    defaults: { serviceTimeMs: 1, concurrency: 500, capacity: 10000, failureRate: 0 },
  },
  {
    id: "waf",
    name: "WAF",
    category: "Traffic & Edge",
    icon: "🛡️", // 🛡️
    defaults: { serviceTimeMs: 1, concurrency: 300, capacity: 8000, failureRate: 0 },
  },
  {
    id: "api-gateway",
    name: "API Gateway",
    category: "Traffic & Edge",
    icon: "🚪", // 🚪
    defaults: { serviceTimeMs: 2, concurrency: 400, capacity: 8000, failureRate: 0 },
  },
  {
    id: "ingress",
    name: "Ingress",
    category: "Traffic & Edge",
    icon: "↪️", // ↪️
    defaults: { serviceTimeMs: 1, concurrency: 300, capacity: 6000, failureRate: 0 },
  },

  // --- Compute ---
  {
    id: "app-server",
    name: "App Server",
    category: "Compute",
    icon: "🖥️", // 🖥️
    defaults: { serviceTimeMs: 5, concurrency: 30, capacity: 1000, failureRate: 0 },
  },
  {
    id: "worker",
    name: "Worker",
    category: "Compute",
    icon: "⚙️", // ⚙️
    defaults: { serviceTimeMs: 20, concurrency: 30, capacity: 2000, failureRate: 0 },
  },
  {
    id: "serverless",
    name: "Serverless",
    category: "Compute",
    icon: "λ", // λ
    defaults: { serviceTimeMs: 10, concurrency: 100, capacity: 5000, failureRate: 0 },
  },
  {
    id: "auth-service",
    name: "Auth Service",
    category: "Compute",
    icon: "🔐", // 🔐
    defaults: { serviceTimeMs: 6, concurrency: 40, capacity: 1000, failureRate: 0 },
  },
  {
    id: "search",
    name: "Search",
    category: "Compute",
    icon: "🔍", // 🔍
    defaults: { serviceTimeMs: 30, concurrency: 20, capacity: 500, failureRate: 0 },
  },
  {
    id: "scheduler",
    name: "Scheduler",
    category: "Compute",
    icon: "⏰", // ⏰
    defaults: { serviceTimeMs: 5, concurrency: 10, capacity: 500, failureRate: 0 },
  },
  {
    id: "notifications",
    name: "Notifications",
    category: "Compute",
    icon: "🔔", // 🔔
    defaults: { serviceTimeMs: 8, concurrency: 30, capacity: 2000, failureRate: 0 },
  },
  {
    id: "analytics",
    name: "Analytics",
    category: "Compute",
    icon: "📊", // 📊
    defaults: { serviceTimeMs: 15, concurrency: 20, capacity: 2000, failureRate: 0 },
  },

  // --- Storage ---
  {
    id: "sql-db",
    name: "SQL Database",
    category: "Storage",
    icon: "🗄️", // 🗄️
    defaults: { serviceTimeMs: 8, concurrency: 40, capacity: 500, failureRate: 0 },
  },
  {
    id: "nosql-db",
    name: "NoSQL DB",
    category: "Storage",
    icon: "📁", // 📁
    defaults: { serviceTimeMs: 5, concurrency: 40, capacity: 2000, failureRate: 0 },
  },
  {
    id: "cache",
    name: "Cache",
    category: "Storage",
    icon: "⚡", // ⚡
    defaults: { serviceTimeMs: 1, concurrency: 200, capacity: 5000, failureRate: 0 },
  },
  {
    id: "object-store",
    name: "Object Store",
    category: "Storage",
    icon: "🧱", // 🧱
    defaults: { serviceTimeMs: 15, concurrency: 50, capacity: 5000, failureRate: 0 },
  },
  {
    id: "data-warehouse",
    name: "Data Warehouse",
    category: "Storage",
    icon: "🏭", // 🏭
    defaults: { serviceTimeMs: 50, concurrency: 10, capacity: 500, failureRate: 0 },
  },
  {
    id: "vector-db",
    name: "Vector DB",
    category: "Storage",
    icon: "🧭", // 🧭
    defaults: { serviceTimeMs: 20, concurrency: 20, capacity: 1000, failureRate: 0 },
  },

  // --- Messaging ---
  {
    id: "message-queue",
    name: "Message Queue",
    category: "Messaging",
    icon: "📨", // 📨
    defaults: { serviceTimeMs: 2, concurrency: 100, capacity: 10000, failureRate: 0 },
  },
  {
    id: "pub-sub",
    name: "Pub/Sub",
    category: "Messaging",
    icon: "📢", // 📢
    defaults: { serviceTimeMs: 2, concurrency: 100, capacity: 10000, failureRate: 0 },
  },
  {
    id: "event-stream",
    name: "Event Stream",
    category: "Messaging",
    icon: "🌊", // 🌊
    defaults: { serviceTimeMs: 3, concurrency: 100, capacity: 20000, failureRate: 0 },
  },
  {
    id: "kafka",
    name: "Kafka",
    category: "Messaging",
    icon: "🧵", // 🧵
    defaults: { serviceTimeMs: 3, concurrency: 150, capacity: 50000, failureRate: 0 },
  },

  // --- Observability ---
  {
    id: "metrics",
    name: "Metrics",
    category: "Observability",
    icon: "📈", // 📈
    defaults: { serviceTimeMs: 1, concurrency: 100, capacity: 10000, failureRate: 0 },
  },
  {
    id: "logs",
    name: "Logs",
    category: "Observability",
    icon: "📝", // 📝
    defaults: { serviceTimeMs: 1, concurrency: 100, capacity: 20000, failureRate: 0 },
  },
  {
    id: "tracing",
    name: "Tracing",
    category: "Observability",
    icon: "🧵", // 🧵
    defaults: { serviceTimeMs: 1, concurrency: 100, capacity: 10000, failureRate: 0 },
  },
  {
    id: "alerting",
    name: "Alerting",
    category: "Observability",
    icon: "🚨", // 🚨
    defaults: { serviceTimeMs: 1, concurrency: 50, capacity: 2000, failureRate: 0 },
  },
  {
    id: "health-check",
    name: "Health Check",
    category: "Observability",
    icon: "✅", // ✅
    defaults: { serviceTimeMs: 1, concurrency: 50, capacity: 2000, failureRate: 0 },
  },

  // --- Network ---
  {
    id: "vpc",
    name: "VPC",
    category: "Network",
    icon: "🏘️", // 🏘️
    defaults: { serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0 },
  },
  {
    id: "subnet",
    name: "Subnet",
    category: "Network",
    icon: "🧩", // 🧩
    defaults: { serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0 },
  },
  {
    id: "nat-gateway",
    name: "NAT Gateway",
    category: "Network",
    icon: "🔀", // 🔀
    defaults: { serviceTimeMs: 1, concurrency: 300, capacity: 10000, failureRate: 0 },
  },
  {
    id: "vpn",
    name: "VPN",
    category: "Network",
    icon: "🔒", // 🔒
    defaults: { serviceTimeMs: 3, concurrency: 100, capacity: 5000, failureRate: 0 },
  },
  {
    id: "service-mesh",
    name: "Service Mesh",
    category: "Network",
    icon: "🕸️", // 🕸️
    defaults: { serviceTimeMs: 1, concurrency: 300, capacity: 10000, failureRate: 0 },
  },

  // --- AI & Agents ---
  {
    id: "llm-gateway",
    name: "LLM Gateway",
    category: "AI & Agents",
    icon: "🧠", // 🧠
    defaults: { serviceTimeMs: 200, concurrency: 20, capacity: 500, failureRate: 0.01 },
  },
  {
    id: "orchestrator",
    name: "Orchestrator",
    category: "AI & Agents",
    icon: "🤖", // 🤖
    defaults: { serviceTimeMs: 30, concurrency: 20, capacity: 500, failureRate: 0 },
  },
  {
    id: "tool-registry",
    name: "Tool Registry",
    category: "AI & Agents",
    icon: "🧰", // 🧰
    defaults: { serviceTimeMs: 5, concurrency: 50, capacity: 1000, failureRate: 0 },
  },
  {
    id: "memory-fabric",
    name: "Memory Fabric",
    category: "AI & Agents",
    icon: "🧵", // 🧵
    defaults: { serviceTimeMs: 10, concurrency: 40, capacity: 2000, failureRate: 0 },
  },
  {
    id: "safety-mesh",
    name: "Safety Mesh",
    category: "AI & Agents",
    icon: "🛡️", // 🛡️
    defaults: { serviceTimeMs: 8, concurrency: 40, capacity: 2000, failureRate: 0 },
  },

  // --- External ---
  {
    id: "third-party-api",
    name: "3rd Party API",
    category: "External",
    icon: "🔌", // 🔌
    defaults: { serviceTimeMs: 100, concurrency: 20, capacity: 500, failureRate: 0.01 },
  },
  {
    id: "payment",
    name: "Payment",
    category: "External",
    icon: "💳", // 💳
    defaults: { serviceTimeMs: 150, concurrency: 15, capacity: 300, failureRate: 0.01 },
  },
  {
    id: "email",
    name: "Email",
    category: "External",
    icon: "📧", // 📧
    defaults: { serviceTimeMs: 80, concurrency: 20, capacity: 1000, failureRate: 0.01 },
  },
];

export function findComponent(id: string): ComponentDef | undefined {
  return CATALOG.find((c) => c.id === id);
}
