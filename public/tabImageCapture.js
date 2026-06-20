export async function captureImageInTab(tabId, url) {
  if (!tabId || !url || !chrome.scripting?.executeScript) {
    return { ok: false, error: "missing-tab" };
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async targetUrl => {
      const normalize = value => {
        try {
          return new URL(String(value || ""), location.href).href;
        } catch {
          return String(value || "");
        }
      };

      const wanted = normalize(targetUrl);
      const wantedPath = (() => {
        try {
          return new URL(wanted).pathname;
        } catch {
          return "";
        }
      })();

      const matchesUrl = candidate => {
        const normalized = normalize(candidate);
        if (!normalized) return false;
        if (normalized === wanted) return true;
        if (!wantedPath) return false;
        try {
          return new URL(normalized).pathname === wantedPath;
        } catch {
          return false;
        }
      };

      const pickImage = () => {
        for (const image of document.images) {
          const candidates = [image.currentSrc, image.src, image.getAttribute("src")].filter(Boolean);
          if (candidates.some(matchesUrl)) return image;
        }
        return null;
      };

      const blobToPayload = async blob => {
        if (!blob || blob.size <= 0) throw new Error("empty-blob");
        const buffer = await blob.arrayBuffer();
        return {
          ok: true,
          bytes: Array.from(new Uint8Array(buffer)),
          mimeType: blob.type || "image/png"
        };
      };

      const referersFor = fetchUrl => {
        const list = [location.href, `${location.origin}/`];
        if (/pximg\.net/i.test(fetchUrl)) {
          list.unshift("https://www.pixiv.net/");
        }
        return [...new Set(list.filter(Boolean))];
      };

      const fetchLikePage = async fetchUrl => {
        let lastStatus = 0;
        for (const referer of referersFor(fetchUrl)) {
          try {
            const response = await fetch(fetchUrl, {
              credentials: "include",
              cache: "force-cache",
              referrer: referer,
              referrerPolicy: "unsafe-url"
            });
            lastStatus = response.status;
            if (!response.ok) continue;
            return blobToPayload(await response.blob());
          } catch {
            // Try the next referer variant.
          }
        }
        throw new Error(String(lastStatus || 403));
      };

      const attempts = [
        async () => fetchLikePage(wanted),
        async () => {
          const image = pickImage();
          if (!image) throw new Error("no-image");
          const candidates = [...new Set([image.currentSrc, image.src].filter(Boolean))];
          let lastError = null;
          for (const candidate of candidates) {
            try {
              return await fetchLikePage(candidate);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError || new Error("fetch-image-failed");
        }
      ];

      for (const attempt of attempts) {
        try {
          return await attempt();
        } catch {
          // Try the next capture strategy.
        }
      }

      return { ok: false, error: "capture-failed" };
    },
    args: [url]
  });

  return injection?.result || { ok: false, error: "no-result" };
}

export function payloadToArrayBuffer(payload) {
  if (!payload?.bytes?.length) return null;
  return new Uint8Array(payload.bytes).buffer;
}

export async function locateImageInTab(tabId, url) {
  if (!tabId || !url || !chrome.scripting?.executeScript) {
    return { ok: false, error: "missing-tab" };
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: targetUrl => {
      const normalize = value => {
        try {
          return new URL(String(value || ""), location.href).href;
        } catch {
          return String(value || "");
        }
      };
      const wanted = normalize(targetUrl);
      const wantedPath = (() => {
        try {
          return new URL(wanted).pathname;
        } catch {
          return "";
        }
      })();
      const matchesUrl = candidate => {
        const normalized = normalize(candidate);
        if (!normalized) return false;
        if (normalized === wanted) return true;
        if (!wantedPath) return false;
        try {
          return new URL(normalized).pathname === wantedPath;
        } catch {
          return false;
        }
      };

      let best = null;
      for (const image of document.images) {
        const candidates = [image.currentSrc, image.src, image.getAttribute("src")].filter(Boolean);
        if (!candidates.some(matchesUrl)) continue;
        const rect = image.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) continue;
        if (!best || rect.width * rect.height > best.width * best.height) {
          best = rect;
        }
      }

      if (!best) return { ok: false, error: "image-not-visible" };
      return {
        ok: true,
        rect: {
          left: Math.max(0, best.left),
          top: Math.max(0, best.top),
          width: Math.max(1, best.width),
          height: Math.max(1, best.height)
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        }
      };
    },
    args: [url]
  });

  return injection?.result || { ok: false, error: "no-result" };
}
