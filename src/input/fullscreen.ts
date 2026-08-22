/**
 * Fullscreen handling for phones.
 *
 * ---------------------------------------------------------------------------
 *  What actually works, per platform
 * ---------------------------------------------------------------------------
 *  Android / Chrome
 *    The Fullscreen API works properly. Calling requestFullscreen() from inside
 *    a user gesture hides the address bar and the tab strip completely. This is
 *    the good case.
 *
 *  iPhone / Safari
 *    Safari on iOS does NOT support requestFullscreen on arbitrary elements, and
 *    there is no way for a web page to hide Safari's chrome on demand. The only
 *    real fullscreen on iOS is "Add to Home Screen": launched from the home
 *    screen icon the page runs standalone, with no address bar at all. That is
 *    why the manifest and apple-mobile-web-app-capable tag are set up - see the
 *    prompt in this module and the note in the README.
 *
 *  Both
 *    Scrolling the page down normally shrinks the browser bars, but the game
 *    deliberately disables scrolling (it would fight with the touch controls),
 *    so that trick is unavailable here.
 * ---------------------------------------------------------------------------
 */

/** True when the document is currently fullscreen. */
export function isFullscreen(): boolean {
  return Boolean(
    document.fullscreenElement ??
      (document as unknown as { webkitFullscreenElement?: Element })
        .webkitFullscreenElement,
  );
}

/** True when the browser exposes any usable fullscreen entry point. */
export function fullscreenSupported(): boolean {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  return Boolean(el.requestFullscreen ?? el.webkitRequestFullscreen);
}

/**
 * True when the page is already running without browser chrome, either because
 * it was launched from the home screen or because we entered fullscreen.
 */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(
    iosStandalone ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches,
  );
}

/**
 * Requests fullscreen. Must be called from inside a user gesture, otherwise
 * browsers reject it silently.
 *
 * Failures are swallowed on purpose: fullscreen is a nice-to-have, and a
 * rejected promise here should never interrupt the game.
 */
export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Denied, or already fullscreen. Nothing useful to do about it.
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
  } catch {
    // Ignore.
  }
}

/** Toggles fullscreen, returning the resulting state. */
export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen();
}

/**
 * Tries to lock the screen to landscape.
 *
 * Only works while fullscreen, and only on browsers that implement the
 * Screen Orientation API (Chrome on Android does; iOS Safari does not). When it
 * works the rotate-your-phone prompt effectively never appears again.
 */
export async function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: string) => Promise<void>;
  };
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Not supported, or not allowed outside fullscreen. Harmless.
  }
}

/**
 * True on iOS/iPadOS, where fullscreen is only available via Add to Home Screen.
 *
 * The iPadOS case needs care. Since iPadOS 13 an iPad reports itself as
 * "MacIntel" with touch points, so that pair is the usual way to spot one. But a
 * desktop Chrome in mobile emulation looks identical: MacIntel platform, five
 * touch points, and a UA that still contains "Safari" (every WebKit-derived UA
 * does). Testing for touch alone therefore produced a false positive and would
 * have shown the "Add to Home Screen" tip to desktop users.
 *
 * Requiring the absence of Chrome/Edge and the presence of Apple as the vendor
 * separates them: real Safari reports vendor "Apple Computer, Inc.".
 */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  const isChromiumFamily = /Chrome|Chromium|CriOS|Edg|OPR/.test(ua);

  // iPhone and iPod are unambiguous, as long as it is not Chrome on iOS
  // (which is still WebKit underneath, so the hint applies there too).
  if (/iPhone|iPod/.test(ua)) return true;
  if (/iPad/.test(ua)) return true;

  // iPadOS 13+ masquerading as a Mac: require real Safari, not emulated Chrome.
  const looksLikeIpadOs =
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1 &&
    !isChromiumFamily &&
    /Apple/.test(navigator.vendor);

  return looksLikeIpadOs;
}
