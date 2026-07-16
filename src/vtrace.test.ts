/// <reference types="jest" />

import { VTrace } from "./vtrace";

function createImageData(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    data.set(rgba, i * 4);
  }

  return { width, height, data } as ImageData;
}

describe("VTrace", () => {
  it("generates an SVG with configured dimensions and background", () => {
    const vtrace = new VTrace(createImageData(2, 3, [255, 255, 255, 255]), {
      background: "white",
      color: "black",
      width: 20,
      height: 30,
    });

    expect(vtrace.getSVG()).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30" viewBox="0 0 20 30" version="1.1">\n' +
        '\t<rect x="0" y="0" width="100%" height="100%" fill="white" />\n' +
        '\t<path d="" stroke="none" fill="black" fill-rule="evenodd"/>\n' +
        "</svg>",
    );
  });

  it("traces opaque black pixels into a non-empty path", () => {
    const vtrace = new VTrace(createImageData(2, 2, [0, 0, 0, 255]), {
      threshold: 128,
      turdSize: 0,
    });

    expect(vtrace.getPathTag()).toMatch(
      /^<path d=".+" stroke="none" fill="black" fill-rule="evenodd"\/>$/,
    );
  });

  it("generates SVG path data directly", () => {
    const vtrace = new VTrace(createImageData(2, 2, [0, 0, 0, 255]), {
      threshold: 128,
      turdSize: 0,
    });

    const path = vtrace.getSVGPath();

    expect(path).toMatch(/^M /);
    expect(path).not.toContain("<path");
  });

  it("applies explicit and configured scaling and translation to SVG path data", () => {
    const image = createImageData(2, 3, [0, 0, 0, 255]);
    const explicit = new VTrace(image, {
      threshold: 128,
      turdSize: 0,
    }).getSVGPath({ x: 2, y: 3 }, { x: 5, y: 7 });
    const configured = new VTrace(image, {
      threshold: 128,
      turdSize: 0,
      width: 4,
      height: 9,
    }).getSVGPath(undefined, { x: 5, y: 7 });

    expect(configured).toBe(explicit);
  });

  it("generates simplified SVG path data with statistics", () => {
    const vtrace = new VTrace(createImageData(2, 2, [0, 0, 0, 255]), {
      threshold: 128,
      turdSize: 0,
    });

    const simplified = vtrace.getSimplifiedSVGPath(undefined, undefined, {
      flattenTolerance: 0.5,
      simplifyTolerance: 0.1,
    });

    expect(simplified.originalPath).toBe(vtrace.getSVGPath());
    expect(simplified.d).toEqual(expect.any(String));
    expect(simplified.stats.pointsBefore).toBeGreaterThanOrEqual(
      simplified.stats.pointsAfter,
    );
    expect(simplified.stats.subPaths).toBeGreaterThanOrEqual(0);
  });

  it("validates supported option values", () => {
    const image = createImageData(1, 1, [255, 255, 255, 255]);

    expect(() => new VTrace(image, { threshold: 256 })).toThrow(
      "Bad threshold value",
    );
    expect(
      () => new VTrace(image, { optCurve: "yes" as unknown as boolean }),
    ).toThrow("'optCurve' must be Boolean");
    expect(() => new VTrace(image, { mode: "curve" as never })).toThrow(
      "Bad mode value",
    );
  });

  it("supports VTracer curve fitting modes", () => {
    const image = createImageData(3, 3, [0, 0, 0, 255]);

    expect(
      new VTrace(image, {
        mode: "polygon",
        threshold: 128,
        turdSize: 0,
      }).getSVGPath().length,
    ).toBeGreaterThan(0);
    expect(
      new VTrace(image, {
        mode: "pixel",
        threshold: 128,
        turdSize: 0,
      }).getSVGPath().length,
    ).toBeGreaterThan(0);
  });
});
