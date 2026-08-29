import { readdirSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SURFACES } from "@/lib/surfaces";

/** Route segments under app/ that render a page, ignoring API routes. */
function routesOnDisk(): string[] {
  return readdirSync("app")
    .filter((entry) => {
      if (entry.startsWith("_") || entry.startsWith("[") || entry === "api") return false;
      if (!statSync(`app/${entry}`).isDirectory()) return false;
      try {
        return statSync(`app/${entry}/page.tsx`).isFile();
      } catch {
        return false;
      }
    })
    .map((entry) => `/${entry}`);
}

describe("SURFACES", () => {
  test("lists every page in the app", () => {
    // The home page links these and the header navigates them; a screen missing
    // here is a screen users cannot find.
    const listed = SURFACES.map((s) => s.href).sort();
    const onDisk = routesOnDisk()
      .filter((r) => r !== "/welcome") // reached by redirect, not by navigation
      .sort();
    expect(listed).toEqual(onDisk);
  });

  test("points only at routes that exist", () => {
    for (const { href } of SURFACES) {
      expect(() => statSync(`app${href}/page.tsx`)).not.toThrow();
    }
  });

  test("every entry carries a label and a blurb", () => {
    for (const s of SURFACES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
    }
  });

  test("no duplicates", () => {
    expect(new Set(SURFACES.map((s) => s.href)).size).toBe(SURFACES.length);
  });
});
