import * as utils from "./utils";

describe("utils", () => {
  it("caches HTML attribute regexps", () => {
    expect(utils.getAttrRegexp("width")).toBe(utils.getAttrRegexp("width"));
  });

  it("checks numeric ranges", () => {
    expect(utils.between(5, 1, 5)).toBe(true);
    expect(utils.between(6, 1, 5)).toBe(false);
  });

  it("computes color luminance", () => {
    expect(utils.luminance(255, 255, 255)).toBe(255);
    expect(utils.luminance(0, 0, 0)).toBe(0);
    expect(utils.luminance(255, 0, 0)).toBe(54);
  });
});
