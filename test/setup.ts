import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no Obsidian globals; map activeDocument/activeWindow to the jsdom document/window
// so popout-compat code (which uses activeDocument/activeWindow) works under test.
Object.assign(globalThis, { activeDocument: document, activeWindow: window });

// jsdom doesn't implement the Pointer Capture API; stub it so pointer handlers that capture/release
// (e.g. the board pan-scroll) don't throw under test.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(() => cleanup());
