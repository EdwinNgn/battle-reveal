/**
 * Minimal DOM + canvas stubs, enough to run the real Game class under Node.
 *
 * Shared by smokeTest.mjs and flowCheck.mjs. Records every 2D context call so a
 * screen that silently draws nothing can be detected.
 */

let drawCalls = 0;

export function getDrawCalls() {
  return drawCalls;
}

const CTX_METHODS = [
  "fillRect", "strokeRect", "clearRect", "beginPath", "closePath", "moveTo",
  "lineTo", "arc", "arcTo", "rect", "fill", "stroke", "save", "restore",
  "translate", "scale", "rotate", "setTransform", "resetTransform", "clip",
  "fillText", "strokeText", "drawImage", "quadraticCurveTo", "bezierCurveTo",
  "setLineDash", "ellipse",
];

const makeGradient = () => ({ addColorStop() {} });

function makeCtx() {
  const ctx = {
    canvas: null,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
    miterLimit: 10,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "",
    shadowBlur: 0,
    textAlign: "start",
    textBaseline: "alphabetic",
    letterSpacing: "0px",
    imageSmoothingEnabled: true,
    createLinearGradient: makeGradient,
    createRadialGradient: makeGradient,
    createPattern: () => null,
    measureText: (t) => ({ width: String(t).length * 10 }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  for (const m of CTX_METHODS) {
    ctx[m] = () => {
      drawCalls++;
    };
  }
  return ctx;
}

class StubClassList {
  constructor() {
    this.set = new Set();
  }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  toggle(c, on) {
    if (on === undefined) this.set.has(c) ? this.set.delete(c) : this.set.add(c);
    else if (on) this.set.add(c);
    else this.set.delete(c);
  }
  contains(c) { return this.set.has(c); }
}

function makeElement(tag = "div") {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    classList: new StubClassList(),
    className: "",
    textContent: "",
    children: [],
    tabIndex: 0,
    width: 960,
    height: 540,
    hidden: false,
    listeners: {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    remove() {},
    setAttribute() {},
    toggleAttribute(_n, v) { this.hidden = !v; },
    insertAdjacentHTML() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    getContext() { const c = makeCtx(); c.canvas = this; return c; },
    dispatch(type, ev = {}) {
      for (const fn of this.listeners[type] || []) {
        fn({ preventDefault() {}, stopPropagation() {}, ...ev });
      }
    },
  };
}

/** Installs the globals and returns the elements the Game needs. */
export function installDomStubs() {
  const canvas = makeElement("canvas");
  const touchLayer = makeElement("div");
  const rotateOverlay = makeElement("div");
  const windowListeners = {};

  globalThis.window = {
    innerWidth: 1366,
    innerHeight: 768,
    devicePixelRatio: 2,
    maxTouchPoints: 0,
    addEventListener(type, fn) { (windowListeners[type] ||= []).push(fn); },
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: () => 0,
    setInterval: () => 0,
    clearInterval: () => {},
    AudioContext: undefined,
    location: { search: "" },
  };

  globalThis.document = {
    body: makeElement("body"),
    getElementById(id) {
      if (id === "game") return canvas;
      if (id === "touch-layer") return touchLayer;
      if (id === "rotate-overlay") return rotateOverlay;
      return null;
    },
    createElement: (tag) => makeElement(tag),
    addEventListener() {},
  };

  globalThis.performance = { now: () => Date.now() };
  Object.defineProperty(globalThis, "navigator", {
    value: { maxTouchPoints: 0, userAgent: "node" },
    configurable: true,
    writable: true,
  });
  globalThis.requestAnimationFrame = () => 0;

  return { canvas, touchLayer, rotateOverlay };
}
