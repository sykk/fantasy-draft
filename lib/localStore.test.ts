import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { currentIdentity } from "@/lib/identity";
import { localStore } from "@/lib/localStore";

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function signedInAs(name: string | null) {
  vi.stubGlobal("document", { cookie: name === null ? "" : `draftlab-user=${name}` });
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", fakeLocalStorage());
  signedInAs("brandon");
});

afterEach(() => vi.unstubAllGlobals());

describe("currentIdentity", () => {
  test("reads the signed-in name", () => {
    expect(currentIdentity()).toBe("brandon");
  });

  test("decodes a name that was escaped into the cookie", () => {
    signedInAs("ana%20maria");
    expect(currentIdentity()).toBe("ana maria");
  });

  test("finds the cookie among others", () => {
    vi.stubGlobal("document", { cookie: "theme=dark; draftlab-user=sam; other=1" });
    expect(currentIdentity()).toBe("sam");
  });

  test("is null when nobody has chosen a name", () => {
    signedInAs(null);
    expect(currentIdentity()).toBeNull();
  });
});

describe("localStore", () => {
  test("round-trips a value", () => {
    localStore.setItem("draft", "{}");
    expect(localStore.getItem("draft")).toBe("{}");
  });

  test("keeps two people on one browser apart", () => {
    localStore.setItem("draft", "brandons-draft");
    signedInAs("sam");
    expect(localStore.getItem("draft")).toBeNull();

    localStore.setItem("draft", "sams-draft");
    signedInAs("brandon");
    expect(localStore.getItem("draft")).toBe("brandons-draft");
  });

  test("scopes the stored key by name", () => {
    localStore.setItem("draft", "x");
    expect([...(localStorage as unknown as ReturnType<typeof fakeLocalStorage>).map.keys()]).toEqual([
      "brandon:draft",
    ]);
  });

  test("falls back to a shared bucket when signed out", () => {
    signedInAs(null);
    localStore.setItem("draft", "x");
    expect(localStore.getItem("draft")).toBe("x");
  });

  test("removeItem clears only that identity's copy", () => {
    localStore.setItem("draft", "mine");
    signedInAs("sam");
    localStore.setItem("draft", "theirs");
    localStore.removeItem("draft");
    signedInAs("brandon");
    expect(localStore.getItem("draft")).toBe("mine");
  });

  test("a storage that throws does not take the caller down", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("private mode");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {
        throw new Error("nope");
      },
    });
    expect(() => localStore.setItem("draft", "x")).not.toThrow();
    expect(localStore.getItem("draft")).toBeNull();
    expect(() => localStore.removeItem("draft")).not.toThrow();
  });
});
