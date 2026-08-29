import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { remoteStorage } from "@/lib/remoteStorage";
import { messageForStatus, useSaveState } from "@/lib/saveState";

const initial = useSaveState.getState();

beforeEach(() => {
  useSaveState.setState({ pending: 0, lastError: null, savedAt: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSaveState.setState(initial);
});

function respondWith(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn(() => {
    const next = responses.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ok = () => new Response(null, { status: 204 });
const fail = (status: number) => new Response(null, { status });

describe("setItem", () => {
  test("reports a successful write and clears any earlier failure", async () => {
    useSaveState.setState({ lastError: "something earlier" });
    respondWith(ok());

    await remoteStorage.setItem("draftlab-rankings", "{}");

    const state = useSaveState.getState();
    expect(state.lastError).toBeNull();
    expect(state.pending).toBe(0);
    expect(state.savedAt).not.toBeNull();
  });

  test("a rejected write throws instead of looking like a save", async () => {
    respondWith(fail(500));
    await expect(remoteStorage.setItem("k", "{}")).rejects.toThrow(/could not store/i);
  });

  test("and records why, so the user can be told", async () => {
    respondWith(fail(401));
    await expect(remoteStorage.setItem("k", "{}")).rejects.toThrow();
    expect(useSaveState.getState().lastError).toBe(messageForStatus(401));
    expect(useSaveState.getState().savedAt).toBeNull();
  });

  test("a network failure is reported too, not swallowed", async () => {
    respondWith(new TypeError("Failed to fetch"));
    await expect(remoteStorage.setItem("k", "{}")).rejects.toThrow();
    expect(useSaveState.getState().lastError).toBeTruthy();
  });

  test("a failed write leaves nothing in flight", async () => {
    respondWith(fail(500));
    await expect(remoteStorage.setItem("k", "{}")).rejects.toThrow();
    expect(useSaveState.getState().pending).toBe(0);
  });

  test("PUTs the value to the key's own endpoint", async () => {
    const fetchMock = respondWith(ok());
    await remoteStorage.setItem("draftlab-tiers", '{"a":1}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/store/draftlab-tiers");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ value: '{"a":1}' }));
  });
});

describe("overlapping writes", () => {
  test("one failure among several still ends up reported", async () => {
    respondWith(ok(), fail(500), ok());
    const results = await Promise.allSettled([
      remoteStorage.setItem("a", "1"),
      remoteStorage.setItem("b", "2"),
      remoteStorage.setItem("c", "3"),
    ]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(useSaveState.getState().pending).toBe(0);
  });
});

describe("removeItem", () => {
  test("is held to the same standard as a write", async () => {
    respondWith(fail(500));
    await expect(remoteStorage.removeItem("k")).rejects.toThrow();
    expect(useSaveState.getState().lastError).toBeTruthy();
  });
});

describe("getItem", () => {
  test("returns null for a missing key rather than throwing", async () => {
    respondWith(fail(404));
    await expect(remoteStorage.getItem("k")).resolves.toBeNull();
  });

  test("a read never touches the save indicator", async () => {
    respondWith(new Response(JSON.stringify({ value: "{}" }), { status: 200 }));
    await remoteStorage.getItem("k");
    expect(useSaveState.getState().savedAt).toBeNull();
    expect(useSaveState.getState().pending).toBe(0);
  });
});

describe("messageForStatus", () => {
  test("names the fix when there is no identity", () => {
    expect(messageForStatus(401)).toMatch(/sign|name/i);
  });

  test("falls back to the status code for anything unexpected", () => {
    expect(messageForStatus(418)).toContain("418");
  });
});
