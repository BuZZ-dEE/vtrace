import {
  SimplifyOptions,
  SimplifyResult,
  SvgPathSimplifier,
} from "./svg-path-simplifier";
import * as utils from "./utils";
import { to_svg as traceToSvg } from "./vtracer-embedded";

type VTracerMode = "pixel" | "polygon" | "spline";

export interface VTraceOptions {
  /** Suppress speckles up to this size. Defaults to `2`. */
  turdSize?: number;
  /** Whether spline curve fitting is enabled. Defaults to `true`. */
  optCurve?: boolean;
  /** Threshold below which luminance is considered black, from `0` to `255`, or `VTrace.THRESHOLD_AUTO`. */
  threshold?: number;
  /** Whether darker pixels are traced as foreground. Defaults to `true`. */
  blackOnWhite?: boolean;
  /** Foreground color. Defaults to `VTrace.COLOR_AUTO`; ignored when exporting as `<symbol>`. */
  color?: string;
  /** Background color. Defaults to `VTrace.COLOR_TRANSPARENT`; ignored when exporting as `<symbol>`. */
  background?: string;
  /** Output SVG width. Defaults to the source image width. */
  width?: number;
  /** Output SVG height. Defaults to the source image height. */
  height?: number;
  /** VTracer curve fitting mode. Defaults to `spline`; `pixel` maps to VTracer's unsimplified mode. */
  mode?: VTracerMode;
  /** VTracer minimum momentary angle, in degrees, to be considered a corner. Defaults to `60`. */
  cornerThreshold?: number;
  /** VTracer segment length threshold. Defaults to `4`. */
  lengthThreshold?: number;
  /** Alias for `lengthThreshold`, matching the VTracer CLI name. */
  segmentLength?: number;
  /** VTracer maximum smoothing iterations. Defaults to `10`. */
  maxIterations?: number;
  /** VTracer minimum angle displacement, in degrees, to splice a spline. Defaults to `45`. */
  spliceThreshold?: number;
  /** VTracer decimal places for generated path data. Defaults to `8`. */
  pathPrecision?: number;
}

interface _VTraceOptions {
  turdSize: number;
  optCurve: boolean;
  threshold: number;
  blackOnWhite: boolean;
  color: string;
  background: string;
  width: number;
  height: number;
  mode: VTracerMode;
  cornerThreshold: number;
  lengthThreshold: number;
  segmentLength?: number;
  maxIterations: number;
  spliceThreshold: number;
  pathPrecision: number;
}

type VTraceParameterValue = _VTraceOptions[keyof _VTraceOptions] | undefined;

const VTRACER_MODE_VALUES: Array<VTracerMode> = ["pixel", "polygon", "spline"];

function formatNumber(value: number, precision = 8): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.parseFloat(value.toFixed(precision)).toString();
}

function getAttribute(tag: string, attribute: string): string | undefined {
  return tag.match(utils.getAttrRegexp(attribute))?.[1];
}

function getTranslate(tag: string): { x: number; y: number } {
  const transform = getAttribute(tag, "transform");
  const match = transform?.match(
    /translate\(\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?)\s*(?:,|\s)\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?)?\s*\)/i,
  );

  return {
    x: match ? Number(match[1]) : 0,
    y: match?.[2] ? Number(match[2]) : 0,
  };
}

const PATH_PARAM_COUNTS: Record<string, number> = {
  A: 7,
  C: 6,
  H: 1,
  L: 2,
  M: 2,
  Q: 4,
  S: 4,
  T: 2,
  V: 1,
  Z: 0,
};

function isCommand(token: string): boolean {
  return /^[a-z]$/i.test(token);
}

function transformPathData(
  d: string,
  scale: { x: number; y: number },
  trans: { x: number; y: number },
  pathTranslate: { x: number; y: number },
  precision: number,
): string {
  const tokens =
    d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  const output: Array<string> = [];
  let i = 0;
  let command = "";

  function transformParams(
    sourceCommand: string,
    values: Array<number>,
  ): Array<string> {
    const upperCommand = sourceCommand.toUpperCase();
    const relative = sourceCommand !== upperCommand;
    const transformed = [...values];

    if (upperCommand === "H") {
      transformed[0] = relative
        ? values[0] * scale.x
        : (values[0] + pathTranslate.x) * scale.x + trans.x;
    } else if (upperCommand === "V") {
      transformed[0] = relative
        ? values[0] * scale.y
        : (values[0] + pathTranslate.y) * scale.y + trans.y;
    } else if (upperCommand === "A") {
      transformed[0] = values[0] * scale.x;
      transformed[1] = values[1] * scale.y;
      transformed[5] = relative
        ? values[5] * scale.x
        : (values[5] + pathTranslate.x) * scale.x + trans.x;
      transformed[6] = relative
        ? values[6] * scale.y
        : (values[6] + pathTranslate.y) * scale.y + trans.y;
    } else {
      for (let index = 0; index < transformed.length; index += 2) {
        transformed[index] = relative
          ? values[index] * scale.x
          : (values[index] + pathTranslate.x) * scale.x + trans.x;
        transformed[index + 1] = relative
          ? values[index + 1] * scale.y
          : (values[index + 1] + pathTranslate.y) * scale.y + trans.y;
      }
    }

    return transformed.map((value) => formatNumber(value, precision));
  }

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      command = tokens[i++];
      output.push(command.toUpperCase());
    }

    const upperCommand = command.toUpperCase();
    const paramCount = PATH_PARAM_COUNTS[upperCommand];
    if (paramCount == null) {
      break;
    }
    if (paramCount === 0) {
      continue;
    }

    let firstSetForCommand = true;
    while (i < tokens.length && !isCommand(tokens[i])) {
      const values = tokens
        .slice(i, i + paramCount)
        .map((token) => Number(token));
      if (
        values.length < paramCount ||
        values.some((value) => Number.isNaN(value))
      ) {
        break;
      }

      if (!firstSetForCommand || upperCommand === "M") {
        const repeatedCommand =
          upperCommand === "M" && !firstSetForCommand ? "L" : upperCommand;
        if (output[output.length - 1] !== repeatedCommand) {
          output.push(repeatedCommand);
        }
      }

      output.push(...transformParams(command, values));
      i += paramCount;
      firstSetForCommand = false;
    }
  }

  return output.join(" ");
}

/**
 * Traces bitmap image data with VTracer and renders it as SVG path data or SVG markup.
 *
 * @param {ImageData} target - Source RGBA image data.
 * @param {VTraceOptions} [options] - Optional tracing and output settings.
 */
export class VTrace {
  private _imageData: ImageData;
  private _pathData: string;
  private _processed: boolean;
  private _params: _VTraceOptions;

  constructor(target: ImageData, options?: VTraceOptions) {
    this._pathData = "";
    this._processed = false;

    this._params = {
      turdSize: 2,
      optCurve: true,
      threshold: VTrace.THRESHOLD_AUTO,
      blackOnWhite: true,
      color: VTrace.COLOR_AUTO,
      background: VTrace.COLOR_TRANSPARENT,
      width: 0,
      height: 0,
      mode: "spline",
      cornerThreshold: 60,
      lengthThreshold: 4,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 8,
    };

    if (options) {
      this.setParameters(options);
    }

    this._imageData = target;
  }

  static COLOR_AUTO = "auto";
  static COLOR_TRANSPARENT = "transparent";
  static THRESHOLD_AUTO = -1;

  private _getLuminanceData(): Uint8Array {
    const bitmap = new Uint8Array(
      this._imageData.width * this._imageData.height,
    );
    const pixels = this._imageData.data;

    for (let i = 0; i < bitmap.length; i++) {
      const idx = i * 4;
      const opacity = pixels[idx + 3] / 255;
      const r = 255 + (pixels[idx] - 255) * opacity;
      const g = 255 + (pixels[idx + 1] - 255) * opacity;
      const b = 255 + (pixels[idx + 2] - 255) * opacity;
      bitmap[i] = utils.luminance(r, g, b);
    }

    return bitmap;
  }

  private _autoThreshold(luminanceData: Uint8Array): number {
    const histogram = new Uint32Array(256);

    for (const luminance of luminanceData) {
      histogram[luminance]++;
    }

    let total = luminanceData.length;
    let sum = 0;
    for (let i = 0; i < histogram.length; i++) {
      sum += i * histogram[i];
    }

    let backgroundWeight = 0;
    let backgroundSum = 0;
    let maxVariance = 0;
    let threshold = 128;

    for (let i = 0; i < histogram.length; i++) {
      backgroundWeight += histogram[i];
      if (backgroundWeight === 0) {
        continue;
      }

      const foregroundWeight = total - backgroundWeight;
      if (foregroundWeight === 0) {
        break;
      }

      backgroundSum += i * histogram[i];
      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const variance =
        backgroundWeight *
        foregroundWeight *
        (backgroundMean - foregroundMean) *
        (backgroundMean - foregroundMean);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    total = 0;
    for (const count of histogram) {
      if (count > 0) {
        total++;
      }
    }

    return total > 1 ? threshold : 128;
  }

  private _createBinaryImageData(): ImageData {
    const luminanceData = this._getLuminanceData();
    const threshold =
      this._params.threshold === VTrace.THRESHOLD_AUTO
        ? this._autoThreshold(luminanceData)
        : this._params.threshold;
    const data = new Uint8ClampedArray(luminanceData.length * 4);

    for (let i = 0; i < luminanceData.length; i++) {
      const foreground = this._params.blackOnWhite
        ? luminanceData[i] <= threshold
        : luminanceData[i] >= threshold;
      const value = foreground ? 0 : 255;
      const idx = i * 4;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }

    return {
      width: this._imageData.width,
      height: this._imageData.height,
      data,
    } as ImageData;
  }

  private _getVTracerMode(): "pixel" | "polygon" | "spline" {
    if (!this._params.optCurve) {
      return "polygon";
    }

    return this._params.mode;
  }

  private _trace(): void {
    const imageData = this._createBinaryImageData();

    this._pathData = traceToSvg(
      new Uint8Array(imageData.data),
      imageData.width,
      imageData.height,
      {
        binary: true,
        mode: this._getVTracerMode(),
        hierarchical: "stacked",
        cornerThreshold: this._params.cornerThreshold,
        lengthThreshold:
          this._params.segmentLength ?? this._params.lengthThreshold,
        maxIterations: this._params.maxIterations,
        spliceThreshold: this._params.spliceThreshold,
        filterSpeckle: Math.max(0, Math.floor(this._params.turdSize)),
        colorPrecision: 6,
        layerDifference: 16,
        pathPrecision: this._params.pathPrecision,
      },
    );
    this._processed = true;
  }

  private _ensureProcessed(): void {
    if (!this._processed) {
      this._trace();
    }
  }

  private _extractSVGPath(
    scale: { x: number; y: number },
    trans: { x: number; y: number },
  ): string {
    this._ensureProcessed();

    return (this._pathData.match(/<path\b[^>]*>/gi) ?? [])
      .map((tag) => {
        const d = getAttribute(tag, "d");
        if (!d) {
          return "";
        }

        return transformPathData(
          d,
          scale,
          trans,
          getTranslate(tag),
          this._params.pathPrecision,
        );
      })
      .filter(Boolean)
      .join(" ");
  }

  /**
   * Validates tracing parameters that have restricted value ranges or types.
   *
   * @param {VTraceOptions} params - Parameters to validate.
   * @private
   */
  _validateParameters(params: VTraceOptions): void {
    if (
      params &&
      params.threshold != null &&
      params.threshold !== VTrace.THRESHOLD_AUTO
    ) {
      if (
        typeof params.threshold !== "number" ||
        !utils.between(params.threshold, 0, 255)
      ) {
        throw new Error(
          "Bad threshold value. Expected to be an integer in range 0..255",
        );
      }
    }

    if (
      params &&
      params.optCurve != null &&
      typeof params.optCurve !== "boolean"
    ) {
      throw new Error("'optCurve' must be Boolean");
    }

    if (
      params?.mode != null &&
      VTRACER_MODE_VALUES.indexOf(params.mode) === -1
    ) {
      throw new Error(
        "Bad mode value. Allowed values are: 'pixel', 'polygon', 'spline'",
      );
    }
  }

  /**
   * Sets tracing and output parameters.
   *
   * Parameters affecting traced geometry mark the instance as unprocessed so paths are regenerated on the next render call.
   *
   * @param {VTraceOptions} newParams - Parameters to merge into the current configuration.
   */
  setParameters(newParams: VTraceOptions): void {
    let key: keyof _VTraceOptions, tmpOldVal: VTraceParameterValue;

    this._validateParameters(newParams);

    const thisParams = this._params as Record<
      keyof _VTraceOptions,
      VTraceParameterValue
    >;
    for (key in thisParams) {
      if (
        Object.prototype.hasOwnProperty.call(thisParams, key) &&
        Object.prototype.hasOwnProperty.call(newParams, key)
      ) {
        tmpOldVal = thisParams[key];
        thisParams[key] = newParams[key];

        if (
          tmpOldVal !== thisParams[key] &&
          ["color", "background", "width", "height"].indexOf(key) === -1
        ) {
          this._processed = false;
        }
      }
    }

    if (newParams.segmentLength != null) {
      this._params.lengthThreshold = newParams.segmentLength;
    }
  }

  /**
   * Generates a single SVG `<path>` tag without the surrounding SVG document.
   *
   * @param {string} [fillColor] - Optional fill color overriding the configured foreground color.
   * @param {{x: number, y: number}} [scale={x: 1, y: 1}] - Scale applied to path coordinates.
   * @param {{x: number, y: number}} [trans={x: 0, y: 0}] - Translation applied to path coordinates.
   * @returns {string} SVG `<path>` tag markup.
   */
  getPathTag(
    fillColor?: string,
    scale: { x: number; y: number } = { x: 1, y: 1 },
    trans: { x: number; y: number } = { x: 0, y: 0 },
  ): string {
    fillColor = arguments.length === 0 ? this._params.color : fillColor;

    if (fillColor === VTrace.COLOR_AUTO) {
      fillColor = this._params.blackOnWhite ? "black" : "white";
    }

    return (
      '<path d="' +
      this._extractSVGPath(scale, trans) +
      '" stroke="none" fill="' +
      fillColor +
      '" fill-rule="evenodd"/>'
    );
  }

  /**
   * Returns an SVG `<symbol>` tag with a `viewBox` and no fill color.
   *
   * The fill can be supplied by a `<use>` element.
   *
   * @param {string} id - Symbol id attribute value.
   * @returns {string} SVG `<symbol>` tag markup.
   */
  getSymbol(id: string): string {
    return (
      "<symbol " +
      'viewBox="0 0 ' +
      this._imageData.width +
      " " +
      this._imageData.height +
      '" ' +
      'id="' +
      id +
      '">' +
      this.getPathTag("") +
      "</symbol>"
    );
  }

  /**
   * Generates a complete SVG document string.
   *
   * @param {{x: number, y: number}} [scale] - Optional scale applied to path coordinates.
   * @returns {string} SVG document markup.
   */
  getSVG(scale?: { x: number; y: number }): string {
    const width = this._params.width || this._imageData.width;
    const height = this._params.height || this._imageData.height;
    const scale_ = scale ?? {
      x: this._params.width ? this._params.width / this._imageData.width : 1,
      y: this._params.height ? this._params.height / this._imageData.height : 1,
    };

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="' +
      width +
      '" ' +
      'height="' +
      height +
      '" ' +
      'viewBox="0 0 ' +
      width +
      " " +
      height +
      '" ' +
      'version="1.1">\n' +
      (this._params.background !== VTrace.COLOR_TRANSPARENT
        ? '\t<rect x="0" y="0" width="100%" height="100%" fill="' +
          this._params.background +
          '" />\n'
        : "") +
      "\t" +
      this.getPathTag(this._params.color, scale_) +
      "\n" +
      "</svg>"
    );
  }

  /**
   * Generates SVG path data without wrapping it in a `<path>` tag.
   *
   * @param {{x: number, y: number}} [scale] - Optional scale applied to path coordinates. Defaults to configured output scaling or `{x: 1, y: 1}`.
   * @param {{x: number, y: number}} [trans={x: 0, y: 0}] - Translation applied to path coordinates.
   * @returns {string} SVG path data.
   */
  getSVGPath(
    scale?: { x: number; y: number },
    trans: { x: number; y: number } = { x: 0, y: 0 },
  ): string {
    const scale_ = scale ?? {
      x: this._params.width ? this._params.width / this._imageData.width : 1,
      y: this._params.height ? this._params.height / this._imageData.height : 1,
    };

    return this._extractSVGPath(scale_, trans);
  }

  /**
   * Generates simplified SVG path data and simplification statistics.
   *
   * @param {{x: number, y: number}} [scale] - Optional scale applied to path coordinates. Defaults to configured output scaling or `{x: 1, y: 1}`.
   * @param {{x: number, y: number}} [trans={x: 0, y: 0}] - Translation applied to path coordinates.
   * @param {SimplifyOptions} [options={}] - Optional simplification settings.
   * @returns {SimplifyResult} Simplified path data and statistics.
   */
  getSimplifiedSVGPath(
    scale?: { x: number; y: number },
    trans: { x: number; y: number } = { x: 0, y: 0 },
    options: SimplifyOptions = {},
  ): SimplifyResult {
    return SvgPathSimplifier.simplifyPath(
      this.getSVGPath(scale, trans),
      options,
    );
  }
}
