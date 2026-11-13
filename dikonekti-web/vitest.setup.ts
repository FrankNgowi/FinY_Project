import { afterEach } from "vitest";

// Component tests opt into jsdom with `// @vitest-environment jsdom`.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
