const attrRegexps: { [key: string]: RegExp } = {};

export function getAttrRegexp(attrName: string): RegExp {
  if (attrRegexps[attrName]) {
    return attrRegexps[attrName];
  }

  attrRegexps[attrName] = new RegExp(
    " " + attrName + '="((?:\\\\(?=")"|[^"])+)"',
    "i",
  );
  return attrRegexps[attrName];
}

export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7153 * g + 0.0721 * b);
}

export function between(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}
