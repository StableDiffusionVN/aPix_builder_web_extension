document.addEventListener("dragstart", event => {
  const target = event.target;
  const image = target instanceof HTMLImageElement ? target : target?.closest?.("img");
  if (!image?.currentSrc && !image?.src) return;
  const url = image.currentSrc || image.src;
  try {
    event.dataTransfer?.setData("application/x-apix-image-url", url);
    event.dataTransfer?.setData("text/uri-list", url);
  } catch {
    // Some sites intentionally lock their drag payload. The context menu remains available.
  }
}, true);
