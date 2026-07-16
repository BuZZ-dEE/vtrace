import { SvgPathSimplifier } from "./svg-path-simplifier";

describe("SvgPathSimplifier", () => {
  it("simplifies collinear line points", (): void => {
    const result = SvgPathSimplifier.simplifyPath("M 0 0 L 10 0 L 20 0", {
      simplifyTolerance: 0.1,
    });

    expect(result.originalPath).toBe("M 0 0 L 10 0 L 20 0");
    expect(result.d).toBe("M 0 0 L 20 0");
    expect(result.stats.pointsBefore).toBe(3);
    expect(result.stats.pointsAfter).toBe(2);
    expect(result.stats.reductionPercent).toBe(33.3);
    expect(result.stats.subPaths).toBe(1);
  });

  it("preserves corners when simplifying relative closed paths", (): void => {
    const result = SvgPathSimplifier.simplifyPath("M 0 0 l 10 0 l 0 10 z", {
      simplifyTolerance: 0.1,
    });

    expect(result.d).toBe("M 0 0 L 10 0 L 10 10 Z");
    expect(result.stats.pointsBefore).toBe(4);
    expect(result.stats.pointsAfter).toBe(3);
    expect(result.stats.reductionPercent).toBe(25);
    expect(result.stats.subPaths).toBe(1);
  });

  it("flattens cubic curves before simplifying", (): void => {
    const result = SvgPathSimplifier.simplifyPath("M 0 0 C 0 10 10 10 10 0", {
      flattenTolerance: 10,
      simplifyTolerance: 0.1,
    });

    expect(result.d).toMatch(/^M 0 0 L /);
    expect(result.stats.pointsBefore).toBe(4);
    expect(result.stats.pointsAfter).toBeGreaterThanOrEqual(3);
    expect(result.stats.subPaths).toBe(1);
  });

  it("flattens quadratic curves before simplifying", (): void => {
    const result = SvgPathSimplifier.simplifyPath("M 0 0 Q 10 10 20 0", {
      flattenTolerance: 10,
      simplifyTolerance: 0.1,
    });

    expect(result.d).toMatch(/^M 0 0 L /);
    expect(result.stats.pointsBefore).toBeGreaterThanOrEqual(3);
    expect(result.stats.pointsAfter).toBeGreaterThanOrEqual(3);
    expect(result.stats.subPaths).toBe(1);
  });

  it("returns empty output for empty path data", (): void => {
    const result = SvgPathSimplifier.simplifyPath("");

    expect(result.d).toBe("");
    expect(result.stats.pointsBefore).toBe(0);
    expect(result.stats.pointsAfter).toBe(0);
    expect(result.stats.reductionPercent).toBe(0);
    expect(result.stats.subPaths).toBe(0);
  });
});
