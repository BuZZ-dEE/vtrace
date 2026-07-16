# @buzz-dee/vtrace

A TypeScript image tracing library that converts `ImageData` to SVG using a VTracer-backed WebAssembly engine, with configurable tracing options and optional SVG path simplification.

[![CI](https://github.com/BuZZ-dEE/vtrace/actions/workflows/ci.yml/badge.svg)](https://github.com/BuZZ-dEE/vtrace/actions/workflows/ci.yml)
[![tested with jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://jestjs.io/)
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/%40buzz-dee%2Fvtrace)](https://libraries.io/npm/%40buzz-dee%2Fvtrace)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat)](https://github.com/prettier/prettier)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40buzz-dee%2Fvtrace)](https://bundlephobia.com/package/%40buzz-dee%2Fvtrace)
[![npm](https://img.shields.io/npm/v/%40buzz-dee%2Fvtrace)](https://www.npmjs.com/package/%40buzz-dee%2Fvtrace)
[![License](https://img.shields.io/github/license/BuZZ-dEE/vtrace)](https://github.com/BuZZ-dEE/vtrace/blob/main/LICENSE)

The tracing backend uses [VTracer](https://github.com/visioncortex/vtracer). The WASM runtime is embedded in the distributed JavaScript bundle, so browser and Angular consumers do not need to copy or serve a separate `.wasm` asset.

## Features

- Converts RGBA `ImageData` into SVG markup or SVG path data.
- Uses VTracer for bitmap-to-vector tracing.
- Ships as a self-contained JavaScript package with embedded WASM.
- Works in browser applications without additional WASM asset or MIME-type configuration.
- Supports output scaling, translation, foreground/background colors, thresholding, and speckle filtering.
- Includes optional SVG path simplification utilities.

## Runtime Notes

The package is designed for canvas-style workflows where source pixels are available as `ImageData`:

```typescript
const imageData = canvas.getContext("2d")!.getImageData(0, 0, width, height);
```

The embedded WASM approach increases the JavaScript bundle size compared with loading a separate `.wasm` file, but it avoids runtime failures caused by missing assets, wrong asset URLs, or servers that do not return `application/wasm` for WASM files.

The public class is named `VTrace`. Its tracing implementation is VTracer-backed.

## Installation

```bash
npm install @buzz-dee/vtrace
```

```bash
pnpm add @buzz-dee/vtrace
```

## Usage

```typescript
import {
  VTrace,
  SvgPathSimplifier,
  type VTraceOptions,
} from "@buzz-dee/vtrace";

const imageData = canvas.getContext("2d")!.getImageData(0, 0, width, height);

const options: VTraceOptions = {
  threshold: VTrace.THRESHOLD_AUTO,
  turdSize: 2,
  optCurve: true,
  mode: "spline",
};

const vtrace = new VTrace(imageData, options);

const svg = vtrace.getSVG();
const pathData = vtrace.getSVGPath({ x: 1, y: 1 }, { x: 0, y: 0 });
const defaultPathData = vtrace.getSVGPath();
const simplified = vtrace.getSimplifiedSVGPath(undefined, undefined, {
  flattenTolerance: 0.5,
  simplifyTolerance: 0.1,
});
const simplifiedPath = SvgPathSimplifier.simplifyPath("M 0 0 L 10 0 L 20 0");
```

## API

### `new VTrace(imageData, options?)`

Creates a tracer instance from `ImageData`.

- `imageData`: RGBA image data to trace.
- `options`: optional tracing and output settings.

### Methods

- `getSVG(scale?)`: returns a complete SVG document string. If `scale` is omitted, it uses configured `width` and `height` scaling, or `{ x: 1, y: 1 }`.
- `getSVGPath(scale?, trans?)`: returns SVG path data only. If `scale` is omitted, it uses configured `width` and `height` scaling, or `{ x: 1, y: 1 }`. If `trans` is omitted, it defaults to `{ x: 0, y: 0 }`.
- `getSimplifiedSVGPath(scale?, trans?, options?)`: returns simplified SVG path data and simplification statistics. `scale` and `trans` use the same defaults as `getSVGPath`.
- `getPathTag(fillColor?, scale?, trans?)`: returns a `<path>` tag.
- `getSymbol(id)`: returns an SVG `<symbol>` tag.
- `setParameters(options)`: updates tracing/output parameters.

`SvgPathSimplifier.simplifyPath(d, options?)` can also simplify arbitrary SVG path data directly.

Scale and translation values use this shape:

```typescript
type TransformPoint = { x: number; y: number };
```

Examples:

```typescript
const path = vtrace.getSVGPath();
const scaledPath = vtrace.getSVGPath({ x: 2, y: 2 });
const movedPath = vtrace.getSVGPath(undefined, { x: 10, y: 20 });
const scaledAndMovedPath = vtrace.getSVGPath({ x: 2, y: 2 }, { x: 10, y: 20 });
```

Simplification options use this shape:

```typescript
interface SimplifyOptions {
  /** Resolution used while flattening curves. */
  flattenTolerance?: number;
  /** Ramer-Douglas-Peucker epsilon used to simplify flattened points. */
  simplifyTolerance?: number;
}
```

The simplified path result contains the path data and statistics:

```typescript
interface SimplifyResult {
  originalPath: string;
  d: string;
  stats: {
    pointsBefore: number;
    pointsAfter: number;
    reductionPercent: number;
    subPaths: number;
  };
}
```

### Options

```typescript
interface VTraceOptions {
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
  mode?: "pixel" | "polygon" | "spline";
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
```

Defaults:

- `turdSize`: `2`
- `optCurve`: `true`
- `threshold`: `VTrace.THRESHOLD_AUTO`
- `blackOnWhite`: `true`
- `color`: `VTrace.COLOR_AUTO`
- `background`: `VTrace.COLOR_TRANSPARENT`
- `width`: source image width
- `height`: source image height
- `mode`: `'spline'`
- `cornerThreshold`: `60`
- `lengthThreshold`: `4`
- `maxIterations`: `10`
- `spliceThreshold`: `45`
- `pathPrecision`: `8`

Compatibility notes:

- `optCurve: false` maps tracing to polygon mode instead of spline mode.

## WASM Bundle Strategy

`src/vtracer-embedded.ts` contains the generated VTracer JavaScript glue code plus an embedded base64 WASM payload. This keeps consumers zero-config:

- no `.wasm` file needs to be listed in Angular `assets`
- no server MIME-type configuration is required
- no runtime `fetch()` is needed to locate the WASM file

If a future package variant needs a smaller JavaScript bundle, an external-WASM entry point can be added separately. The default package favors reliable browser integration.

## Development

This project uses pnpm.

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

Available scripts:

- `pnpm build`: builds the package with Rolldown.
- `pnpm build:wasm`: rebuilds the embedded VTracer WASM wrapper from `rust/vtracer-wasm`.
- `pnpm lint`: lints source files.
- `pnpm test`: runs the Jest test suite.
- `pnpm dev`: runs TypeScript in watch mode.

### Rebuilding VTracer WASM

The distributed package uses `src/vtracer-embedded.ts`, which is generated from the first-party Rust wrapper in `rust/vtracer-wasm`. Rebuild it after changing the Rust wrapper or updating VTracer:

```bash
pnpm build:wasm
```

Requirements:

- Rust with the `wasm32-unknown-unknown` target installed. On rustup-based installs, run `rustup target add wasm32-unknown-unknown`. On Arch Linux, install `rust-wasm`.
- `wasm-bindgen` CLI version matching the Rust crate version in `rust/vtracer-wasm/Cargo.toml`; currently `0.2.126`. Install with `cargo install wasm-bindgen-cli --version 0.2.126 --locked` or your distribution package.
- The script invokes `wasm-bindgen` directly and does not use `wasm-pack`.

## CI and Publishing

GitHub Actions runs build, lint, and test checks on pushes and pull requests targeting `main`.

Publishing is handled by the `Publish` workflow and runs only for version tags such as `v1.2.3` or `v1.2.3-beta.1`.

## License

This project is licensed under the MIT License. For more details, please check the [LICENSE](./LICENSE) file.

VTracer is licensed under MIT OR Apache-2.0. The local WASM wrapper in `rust/vtracer-wasm` depends on the upstream `vtracer` crate.
