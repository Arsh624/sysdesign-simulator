import { describe, it, expect } from "vitest";
import { CATALOG, findComponent } from "./catalog";

describe("catalog", () => {
  it("has components across all categories with valid defaults", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(35);
    for (const c of CATALOG) {
      expect(c.id).toBeTruthy();
      expect(c.defaults.serviceTimeMs).toBeGreaterThanOrEqual(0);
      expect(c.defaults.concurrency).toBeGreaterThan(0);
      expect(c.defaults.capacity).toBeGreaterThan(0);
      expect(c.defaults.failureRate).toBeGreaterThanOrEqual(0);
      expect(c.defaults.failureRate).toBeLessThanOrEqual(1);
    }
  });
  it("includes a source (client) and looks up by id", () => {
    expect(findComponent("client")?.isSource).toBe(true);
    expect(findComponent("sql-db")?.category).toBe("Storage");
  });
});
