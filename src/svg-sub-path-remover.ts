type Point = Readonly<{x: number; y: number}>;

interface SubPath {
  readonly start: number;
  readonly end: number;
  readonly points: readonly Point[];
}

const COMMAND_REGEX = /([MmLlHhVvCcQqSsTtZz])([^MmLlHhVvCcQqSsTtZz]*)/g;
const NUMBER_REGEX = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
const CURVE_TOLERANCE = 0.02;
const BOUNDARY_EPSILON = 1e-9;

/**
 * Removed all sub-paths that lie completely within another sub-path, so that
 * nothing is cut inside an already cut area (no holes in the cut region).
 *
 * Sub-paths that merely overlap or touch another sub-path are kept, and the
 * surviving path data is returned verbatim (lossless).
 */
export function removeInnerSubPaths(d: string): string {
  const subPaths = parseSubPaths(d);
  if (subPaths.length <= 1) {
    return d;
  }

  const toRemove = new Set<number>();
  for (let i = 0; i < subPaths.length; i++) {
    for (let j = 0; j < subPaths.length; j++) {
      if (i === j) {
        continue;
      }
      if (isSubPathWithin(subPaths[i] as SubPath, subPaths[j] as SubPath)) {
        toRemove.add(i);
        break;
      }
    }
  }

  if (toRemove.size === 0) {
    return d;
  }

  return subPaths
    .filter((_, index) => !toRemove.has(index))
    .map(subPath => d.slice(subPath.start, subPath.end))
    .join(' ');
}

function isSubPathWithin(inner: SubPath, outer: SubPath): boolean {
  if (inner.points.length < 3 || outer.points.length < 3) {
    return false;
  }
  return inner.points.every(
    point => pointStatus(point, outer.points) === 'inside',
  );
}

// --- parsing -----------------------------------------------------------------

function parseSubPaths(d: string): SubPath[] {
  const subPaths: SubPath[] = [];
  let points: Point[] = [];
  let subPathStart = 0;

  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let prevControl: Point | null = null;

  const closeCurrent = (end: number): void => {
    if (points.length > 0) {
      subPaths.push({start: subPathStart, end, points});
    }
  };

  for (const match of d.matchAll(COMMAND_REGEX)) {
    const command = match[1];
    if (command === undefined) {
      continue;
    }
    const isRelative = command === command.toLowerCase();
    const type = command.toUpperCase();
    const args = (match[2] ?? '').match(NUMBER_REGEX)?.map(Number) ?? [];
    const index = match.index ?? 0;

    if (type === 'M') {
      closeCurrent(index);
      subPathStart = index;
      points = [];
    }

    let i = 0;
    switch (type) {
      case 'M':
      case 'L': {
        while (i + 1 < args.length) {
          const p = absPoint(args[i], args[i + 1], isRelative, x, y);
          if (i === 0) {
            startX = p.x;
            startY = p.y;
          }
          points.push(p);
          x = p.x;
          y = p.y;
          prevControl = null;
          i += 2;
        }
        break;
      }
      case 'H': {
        while (i < args.length) {
          const p = {x: toAbs(args[i], isRelative, x), y};
          points.push(p);
          x = p.x;
          prevControl = null;
          i += 1;
        }
        break;
      }
      case 'V': {
        while (i < args.length) {
          const p = {x, y: toAbs(args[i], isRelative, y)};
          points.push(p);
          y = p.y;
          prevControl = null;
          i += 1;
        }
        break;
      }
      case 'C': {
        while (i + 5 < args.length) {
          const c1 = absPoint(args[i], args[i + 1], isRelative, x, y);
          const c2 = absPoint(args[i + 2], args[i + 3], isRelative, x, y);
          const p = absPoint(args[i + 4], args[i + 5], isRelative, x, y);
          appendCubic(points, {x, y}, c1, c2, p);
          x = p.x;
          y = p.y;
          prevControl = c2;
          i += 6;
        }
        break;
      }
      case 'S': {
        while (i + 3 < args.length) {
          const c1: Point =
            prevControl === null ? {x, y} : reflect({x, y}, prevControl);
          const c2 = absPoint(args[i], args[i + 1], isRelative, x, y);
          const p = absPoint(args[i + 2], args[i + 3], isRelative, x, y);
          appendCubic(points, {x, y}, c1, c2, p);
          x = p.x;
          y = p.y;
          prevControl = c2;
          i += 4;
        }
        break;
      }
      case 'Q': {
        while (i + 3 < args.length) {
          const c1 = absPoint(args[i], args[i + 1], isRelative, x, y);
          const p = absPoint(args[i + 2], args[i + 3], isRelative, x, y);
          appendQuadratic(points, {x, y}, c1, p);
          x = p.x;
          y = p.y;
          prevControl = c1;
          i += 4;
        }
        break;
      }
      case 'T': {
        while (i + 1 < args.length) {
          const c1: Point =
            prevControl === null ? {x, y} : reflect({x, y}, prevControl);
          const p = absPoint(args[i], args[i + 1], isRelative, x, y);
          appendQuadratic(points, {x, y}, c1, p);
          x = p.x;
          y = p.y;
          prevControl = c1;
          i += 2;
        }
        break;
      }
      case 'Z': {
        x = startX;
        y = startY;
        prevControl = null;
        closeCurrent(index + command.length);
        points = [];
        break;
      }
    }
  }
  closeCurrent(d.length);
  return subPaths;
}

function toAbs(
  value: number | undefined,
  isRelative: boolean,
  base: number,
): number {
  const v = value ?? 0;
  return isRelative ? base + v : v;
}

function absPoint(
  valueX: number | undefined,
  valueY: number | undefined,
  isRelative: boolean,
  baseX: number,
  baseY: number,
): Point {
  return {
    x: toAbs(valueX, isRelative, baseX),
    y: toAbs(valueY, isRelative, baseY),
  };
}

// --- curve flattening ----------------------------------------------------------

function appendCubic(
  into: Point[],
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
): void {
  flattenCubic(into, p0, c1, c2, p3, 0);
}

function flattenCubic(
  into: Point[],
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
  depth: number,
): void {
  const mid = {x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2};
  const flatness = Math.max(distance(c1, mid), distance(c2, mid));
  if (flatness <= CURVE_TOLERANCE || depth >= 12) {
    into.push(p3);
    return;
  }
  const m1 = lerp(p0, c1);
  const m2 = lerp(c1, c2);
  const m3 = lerp(c2, p3);
  const m12 = lerp(m1, m2);
  const m23 = lerp(m2, m3);
  const m123 = lerp(m12, m23);
  flattenCubic(into, p0, m1, m12, m123, depth + 1);
  flattenCubic(into, m123, m23, m3, p3, depth + 1);
}

function appendQuadratic(into: Point[], p0: Point, q1: Point, p1: Point): void {
  const c1 = {
    x: p0.x + (2 / 3) * (q1.x - p0.x),
    y: p0.y + (2 / 3) * (q1.y - p0.y),
  };
  const c2 = {
    x: p1.x + (2 / 3) * (q1.x - p1.x),
    y: p1.y + (2 / 3) * (q1.y - p1.y),
  };
  appendCubic(into, p0, c1, c2, p1);
}

// --- point in polygon ----------------------------------------------------------

type PointStatus = 'inside' | 'outside' | 'on';

function pointStatus(p: Point, polygon: readonly Point[]): PointStatus {
  const n = polygon.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (distanceToSegment(p, a, b) <= BOUNDARY_EPSILON) {
      return 'on';
    }
    if (a.y > p.y !== b.y > p.y) {
      const xIntersect = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (p.x < xIntersect) {
        inside = !inside;
      }
    }
  }
  return inside ? 'inside' : 'outside';
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distance(p, a);
  }
  const t = Math.min(
    1,
    Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared),
  );
  return distance(p, {x: a.x + t * dx, y: a.y + t * dy});
}

// --- helpers -------------------------------------------------------------------

function lerp(a: Point, b: Point): Point {
  return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
}

function reflect(base: Point, prev: Point): Point {
  return {x: 2 * base.x - prev.x, y: 2 * base.y - prev.y};
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
