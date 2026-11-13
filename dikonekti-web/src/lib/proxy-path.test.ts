import { describe, expect, it } from "vitest";
import { resolveProxyPath } from "./proxy-path";

describe("resolveProxyPath", () => {
  it.each([
    [["me"], "GET", "me/"],
    [["alerts"], "GET", "alerts/"],
    [["alerts", "7", "acknowledge"], "PATCH", "alerts/7/acknowledge/"],
    [["patients"], "GET", "patients/"],
    [["appointments"], "GET", "appointments/"],
    [["appointments", "3", "status"], "PATCH", "appointments/3/status/"],
    [["messages"], "GET", "messages/"],
    [["messages"], "POST", "messages/"],
  ])("allows %j %s -> %s", (segments, method, expected) => {
    expect(resolveProxyPath(segments, method)).toBe(expected);
  });

  it("rejects_auth_endpoints", () => {
    expect(resolveProxyPath(["auth", "login"], "POST")).toBeNull();
    expect(resolveProxyPath(["auth", "refresh"], "POST")).toBeNull();
    expect(resolveProxyPath(["auth", "register"], "POST")).toBeNull();
  });

  it("rejects_path_traversal", () => {
    expect(resolveProxyPath(["alerts", "..", "auth", "login"], "GET")).toBeNull();
    expect(resolveProxyPath([".."], "GET")).toBeNull();
    expect(resolveProxyPath(["."], "GET")).toBeNull();
    expect(resolveProxyPath(["%2e%2e", "auth"], "GET")).toBeNull();
    expect(resolveProxyPath(["alerts%2F..%2Fauth"], "GET")).toBeNull();
    expect(resolveProxyPath(["alerts\\..\\auth"], "GET")).toBeNull();
  });

  it("rejects_non_numeric_ids", () => {
    for (const id of ["abc", "1.5", "-1", "1e3", " 1", "1 ", "0x10", "", "99999999999999999999"]) {
      expect(resolveProxyPath(["alerts", id, "acknowledge"], "PATCH")).toBeNull();
      expect(resolveProxyPath(["appointments", id, "status"], "PATCH")).toBeNull();
    }
  });

  it("rejects_wrong_method", () => {
    expect(resolveProxyPath(["alerts"], "DELETE")).toBeNull();
    expect(resolveProxyPath(["alerts"], "POST")).toBeNull();
    expect(resolveProxyPath(["patients"], "POST")).toBeNull();
    expect(resolveProxyPath(["messages"], "PATCH")).toBeNull();
    expect(resolveProxyPath(["alerts", "1", "acknowledge"], "GET")).toBeNull();
    expect(resolveProxyPath(["me"], "PUT")).toBeNull();
  });

  it("is_case_insensitive_on_method_but_not_on_path", () => {
    expect(resolveProxyPath(["alerts"], "get")).toBe("alerts/");
    expect(resolveProxyPath(["ALERTS"], "GET")).toBeNull();
  });

  it("rejects_unlisted_paths", () => {
    expect(resolveProxyPath(["doctors"], "GET")).toBeNull();
    expect(resolveProxyPath(["admin"], "GET")).toBeNull();
    expect(resolveProxyPath([], "GET")).toBeNull();
    expect(resolveProxyPath([""], "GET")).toBeNull();
    expect(resolveProxyPath(["alerts", ""], "GET")).toBeNull();
    expect(resolveProxyPath(["alerts", "1"], "GET")).toBeNull();
    expect(resolveProxyPath(["alerts", "1", "acknowledge", "extra"], "PATCH")).toBeNull();
  });
});
