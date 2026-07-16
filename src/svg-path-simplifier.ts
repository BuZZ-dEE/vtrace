interface Point {
  x: number;
  y: number;
}

/**
 * Options controlling SVG path simplification.
 *
 * @property {number} [flattenTolerance] - Resolution used while flattening curves.
 * @property {number} [simplifyTolerance] - Ramer-Douglas-Peucker epsilon used to simplify flattened points.
 */
export interface SimplifyOptions {
  flattenTolerance?: number; // resolution during curve flattening
  simplifyTolerance?: number; // RDP epsilon
}

/**
 * Summary of a path simplification run.
 *
 * @property {number} pointsBefore - Number of flattened points before simplification.
 * @property {number} pointsAfter - Number of points after simplification.
 * @property {number} reductionPercent - Percentage reduction rounded to one decimal place.
 * @property {number} subPaths - Number of subpaths in the output.
 */
export interface PathStatistics {
  pointsBefore: number;
  pointsAfter: number;
  reductionPercent: number;
  subPaths: number;
}

/**
 * Result returned by {@link SvgPathSimplifier.simplifyPath}.
 *
 * @property {string} originalPath - Original SVG path data before simplification.
 * @property {string} d - Simplified SVG path data.
 * @property {PathStatistics} stats - Simplification statistics.
 */
export interface SimplifyResult {
  originalPath: string;
  d: string;
  stats: PathStatistics;
}

type MoveSegment = { type: "M"; p: Point };
type LineSegment = { type: "L"; p0: Point; p1: Point };
type CubicSegment = { type: "C"; p0: Point; c1: Point; c2: Point; p1: Point };
type QuadraticSegment = { type: "Q"; p0: Point; c: Point; p1: Point };
type CloseSegment = { type: "Z"; p0: Point; p1: Point };

type PathSegment =
  MoveSegment | LineSegment | CubicSegment | QuadraticSegment | CloseSegment;

export class SvgPathSimplifier {
  /* ===================== PUBLIC API ===================== */

  /**
   * Simplifies SVG path data by flattening curves and applying RDP simplification.
   *
   * @param {string} d - SVG path data.
   * @param {SimplifyOptions} [options={}] - Optional simplification settings.
   * @returns {SimplifyResult} Simplified path data and statistics.
   */
  static simplifyPath(
    d: string,
    options: SimplifyOptions = {},
  ): SimplifyResult {
    const flattenTol = options.flattenTolerance ?? 0.5;
    const simplifyTol = options.simplifyTolerance ?? 0.1;

    const segments = this.parsePath(d);

    // 🔢 points before simplifying (after flattening)
    const originalPaths = this.flattenSegments(segments, flattenTol);
    const pointsBefore = originalPaths.reduce((sum, p) => sum + p.length, 0);

    // ✂️ simplify
    const simplifiedPaths = originalPaths.map((p) =>
      this.simplifySubPath(p, simplifyTol),
    );

    const pointsAfter = simplifiedPaths.reduce(
      (sum, p) => sum + p.points.length,
      0,
    );

    // 🧾 build svg
    const simplifiedD = simplifiedPaths
      .map((p) => this.buildPath(p.points, p.closed))
      .join(" ");

    return {
      originalPath: d,
      d: simplifiedD,
      stats: {
        pointsBefore,
        pointsAfter,
        reductionPercent:
          pointsBefore === 0
            ? 0
            : Math.round((1 - pointsAfter / pointsBefore) * 1000) / 10,
        subPaths: simplifiedPaths.length,
      },
    };
  }

  /* ===================== SUBPATH SIMPLIFICATION ===================== */

  private static simplifySubPath(
    points: Point[],
    epsilon: number,
  ): { points: Point[]; closed: boolean } {
    if (points.length < 2) {
      return { points, closed: false };
    }

    const closed =
      points.length > 2 &&
      this.distance(points[0], points[points.length - 1]) < epsilon;

    const openPoints = closed ? points.slice(0, -1) : points;
    const simplified = this.rdp(openPoints, epsilon);

    return {
      points: simplified,
      closed,
    };
  }

  /* ===================== PATH PARSING ===================== */

  private static parsePath(d: string): PathSegment[] {
    const cmdRegex = /([MLCQZmlcqz])([^MLCQZmlcqz]*)/g;
    const segments: PathSegment[] = [];

    let current: Point = { x: 0, y: 0 };
    let start: Point = { x: 0, y: 0 };

    let match: RegExpExecArray | null;

    while ((match = cmdRegex.exec(d))) {
      const cmd = match[1];
      const nums = match[2]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);

      let i = 0;
      const isRel = cmd === cmd.toLowerCase();

      const next = (): Point => {
        const x = nums[i++];
        const y = nums[i++];
        return isRel ? { x: current.x + x, y: current.y + y } : { x, y };
      };

      switch (cmd.toUpperCase()) {
        case "M": {
          const p = next();
          current = start = p;
          segments.push({ type: "M", p });
          break;
        }
        case "L":
          while (i < nums.length) {
            const p = next();
            segments.push({ type: "L", p0: current, p1: p });
            current = p;
          }
          break;
        case "C":
          while (i < nums.length) {
            const c1 = next();
            const c2 = next();
            const p = next();
            segments.push({ type: "C", p0: current, c1, c2, p1: p });
            current = p;
          }
          break;
        case "Q":
          while (i < nums.length) {
            const c = next();
            const p = next();
            segments.push({ type: "Q", p0: current, c, p1: p });
            current = p;
          }
          break;
        case "Z":
          segments.push({ type: "Z", p0: current, p1: start });
          current = start;
          break;
      }
    }

    return segments;
  }

  /* ===================== FLATTENING ===================== */

  private static flattenSegments(
    segments: PathSegment[],
    tol: number,
  ): Point[][] {
    const paths: Point[][] = [];
    let current: Point[] = [];

    const add = (p: Point): void => {
      current.push({ ...p });
    };

    for (const s of segments) {
      if (s.type === "M") {
        if (current.length) paths.push(current);
        current = [s.p];
      } else if (s.type === "L" || s.type === "Z") {
        add(s.p1);
      } else if (s.type === "C") {
        this.flattenCubic(s.p0, s.c1, s.c2, s.p1, tol, add);
      } else if (s.type === "Q") {
        this.flattenQuadratic(s.p0, s.c, s.p1, tol, add);
      }
    }

    if (current.length) paths.push(current);
    return paths;
  }

  private static flattenCubic(
    p0: Point,
    c1: Point,
    c2: Point,
    p1: Point,
    tol: number,
    add: (p: Point) => void,
  ): void {
    const steps = Math.max(
      2,
      Math.ceil(this.curveLength(p0, c1, c2, p1) / tol),
    );

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      add(this.cubicAt(p0, c1, c2, p1, t));
    }
  }

  private static flattenQuadratic(
    p0: Point,
    c: Point,
    p1: Point,
    tol: number,
    add: (p: Point) => void,
  ): void {
    const steps = Math.max(2, Math.ceil(this.distance(p0, p1) / tol));

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      add(this.quadraticAt(p0, c, p1, t));
    }
  }

  /* ===================== RDP ===================== */

  private static rdp(points: Point[], eps: number): Point[] {
    if (points.length < 3) return points;

    let maxDist = 0;
    let index = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const d = this.perpDist(points[i], points[0], points[points.length - 1]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > eps) {
      const left = this.rdp(points.slice(0, index + 1), eps);
      const right = this.rdp(points.slice(index), eps);
      return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[points.length - 1]];
  }

  /* ===================== BUILD SVG ===================== */

  private static buildPath(points: Point[], closed: boolean): string {
    if (!points.length) return "";

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    if (closed) d += " Z";
    return d;
  }

  /* ===================== MATH ===================== */

  private static distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private static perpDist(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return this.distance(p, a);

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);

    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    return this.distance(p, proj);
  }

  private static curveLength(
    p0: Point,
    c1: Point,
    c2: Point,
    p1: Point,
  ): number {
    return (
      this.distance(p0, c1) + this.distance(c1, c2) + this.distance(c2, p1)
    );
  }

  private static cubicAt(
    p0: Point,
    c1: Point,
    c2: Point,
    p1: Point,
    t: number,
  ): Point {
    const u = 1 - t;
    return {
      x:
        u ** 3 * p0.x +
        3 * u ** 2 * t * c1.x +
        3 * u * t ** 2 * c2.x +
        t ** 3 * p1.x,
      y:
        u ** 3 * p0.y +
        3 * u ** 2 * t * c1.y +
        3 * u * t ** 2 * c2.y +
        t ** 3 * p1.y,
    };
  }

  private static quadraticAt(p0: Point, c: Point, p1: Point, t: number): Point {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    };
  }
}
