import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ImageLightbox } from "../src/components/ImageLightbox";

vi.mock("react-dom", async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createPortal: node => node };
});

beforeAll(() => vi.stubGlobal("document", { body: {} }));
afterAll(() => vi.unstubAllGlobals());

describe("ImageLightbox", () => {
  it("renders previous and next controls with the current position", () => {
    const html = renderToStaticMarkup(createElement(ImageLightbox, {
      open: true,
      imageUrl: "blob:preview",
      title: "output-2.png",
      currentPosition: 2,
      total: 3,
      canPrevious: true,
      canNext: true,
      onPrevious: () => {},
      onNext: () => {},
      onClose: () => {}
    }));

    expect(html).toContain('aria-label="Ảnh trước"');
    expect(html).toContain('aria-label="Ảnh tiếp theo"');
    expect(html).toContain("2 / 3");
    expect(html).toContain("output-2.png");
  });

  it("disables navigation beyond the list boundaries", () => {
    const html = renderToStaticMarkup(createElement(ImageLightbox, {
      open: true,
      imageUrl: "blob:preview",
      currentPosition: 1,
      total: 2,
      canPrevious: false,
      canNext: true,
      onClose: () => {}
    }));

    const previousButton = html.match(/<button[^>]*aria-label="Ảnh trước"[^>]*>/)?.[0] || "";
    const nextButton = html.match(/<button[^>]*aria-label="Ảnh tiếp theo"[^>]*>/)?.[0] || "";
    expect(previousButton).toContain("disabled");
    expect(nextButton).not.toContain("disabled");
  });
});
