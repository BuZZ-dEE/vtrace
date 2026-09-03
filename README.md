# @buzz-dee/vtrace

A TypeScript image tracing library that converts `ImageData` to SVG using a VTracer-backed WebAssembly engine, with configurable tracing options, optional SVG path simplification, and optional inner sub-path removal.

[![CI](https://github.com/BuZZ-dEE/vtrace/actions/workflows/ci.yml/badge.svg)](https://github.com/BuZZ-dEE/vtrace/actions/workflows/ci.yml)
[![tested with jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://jestjs.io/)
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/%40buzz-dee%2Fvtrace)](https://libraries.io/npm/%40buzz-dee%2Fvtrace)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat)](https://github.com/prettier/prettier)
[![npm bundle size](https://img.shields.io/bundlephobia/min/%40buzz-dee%2Fvtrace)](https://bundlephobia.com/package/%40buzz-dee%2Fvtrace)
[![npm](https://img.shields.io/npm/v/%40buzz-dee%2Fvtrace)](https://www.npmjs.com/package/%40buzz-dee%2Fvtrace)
[![License](https://img.shields.io/github/license/BuZZ-dEE/vtrace)](https://github.com/BuZZ-dEE/vtrace/blob/main/LICENSE)

The tracing backend uses [VTracer](https://github.com/visioncortex/vtracer). The WASM runtime is embedded in the distributed JavaScript bundle, so browser and Angular consumers do not need to copy or serve a separate `.wasm` asset.

This package is a VTracer-backed alternative to [`potrace-ts`](https://github.com/BuZZ-dEE/potrace-ts) for projects that need `ImageData`-to-SVG tracing with embedded WASM and no separate runtime asset setup.

## Features

- Converts RGBA `ImageData` into SVG markup or SVG path data.
- Uses VTracer for bitmap-to-vector tracing.
- Ships as a self-contained JavaScript package with embedded WASM.
- Works in browser applications without additional WASM asset or MIME-type configuration.
- Supports output scaling, translation, foreground/background colors, thresholding, speckle filtering, VTracer 1.0 clustering modes, curve simplification, palettes, and SVG optimization.
- Includes optional SVG path simplification utilities.
- Can remove sub-paths that are fully contained inside another sub-path.

## Runtime Notes

The package is designed for canvas-style workflows where source pixels are available as `ImageData`:

```typescript
const imageData = canvas.getContext('2d')!.getImageData(0, 0, width, height);
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
import {VTrace, SvgPathSimplifier, type VTraceOptions} from '@buzz-dee/vtrace';

const imageData = canvas.getContext('2d')!.getImageData(0, 0, width, height);

const options: VTraceOptions = {
  threshold: VTrace.THRESHOLD_AUTO,
  turdSize: 2,
  optCurve: true,
  colorMode: 'binary',
  mode: 'spline',
  hierarchical: 'cutout',
};

const vtrace = new VTrace(imageData, options);

const svg = vtrace.getSVG();
const pathData = vtrace.getSVGPath({x: 1, y: 1}, {x: 0, y: 0});
const defaultPathData = vtrace.getSVGPath();
const simplified = vtrace.getSimplifiedSVGPath(undefined, undefined, {
  flattenTolerance: 0.5,
  simplifyTolerance: 0.1,
  removeInnerSubPaths: true,
});
const simplifiedPath = SvgPathSimplifier.simplifyPath('M 0 0 L 10 0 L 20 0');
const cleanedPath = SvgPathSimplifier.removeInnerSubPaths(
  'M 0 0 L 10 0 L 10 10 L 0 10 Z M 2 2 L 4 2 L 4 4 L 2 4 Z',
);
```

VTracer 1.0 options are also available:

```typescript
const poster = new VTrace(imageData, {
  preset: 'poster',
  clustering: 'color-cluster',
  hierarchical: 'cutout',
  simplify: 1.5,
  maxColors: 8,
  optimize: 2,
});

const adaptiveLineArt = new VTrace(imageData, {
  clustering: 'bw',
  adaptive: true,
});

const watershed = new VTrace(imageData, {
  clustering: 'watershed',
  watershedDetail: 192,
  hierarchical: 'cutout',
});

const paletteTrace = new VTrace(imageData, {
  palette: ['#1b1b1b', '#e0c088', '#5a7d3c', '#8fb0d0'],
});
```

## API

### `new VTrace(imageData, options?)`

Creates a tracer instance from `ImageData`.

- `imageData`: RGBA image data to trace.
- `options`: optional tracing and output settings.

### Methods

- `getSVG(scale?)`: returns a complete SVG document string. If `scale` is omitted, it uses configured `width` and `height` scaling, or `{ x: 1, y: 1 }`.
- `getSVGPath(scale?, trans?)`: returns SVG path data only. If `scale` is omitted, it uses configured `width` and `height` scaling, or `{ x: 1, y: 1 }`. If `trans` is omitted, it defaults to `{ x: 0, y: 0 }`.
- `getSimplifiedSVGPath(scale?, trans?, options?)`: returns simplified SVG path data and simplification statistics. `scale` and `trans` use the same defaults as `getSVGPath`. Pass `removeInnerSubPaths: true` to remove fully contained sub-paths before simplification.
- `getPathTag(fillColor?, scale?, trans?)`: returns a `<path>` tag.
- `getSymbol(id)`: returns an SVG `<symbol>` tag.
- `setParameters(options)`: updates tracing/output parameters.

`SvgPathSimplifier.simplifyPath(d, options?)` can also simplify arbitrary SVG path data directly.

`SvgPathSimplifier.removeInnerSubPaths(d)` can remove sub-paths that lie completely inside another sub-path while preserving surviving path data verbatim. Sub-paths that overlap or touch are kept.

Scale and translation values use this shape:

```typescript
type TransformPoint = {x: number; y: number};
```

Examples:

```typescript
const path = vtrace.getSVGPath();
const scaledPath = vtrace.getSVGPath({x: 2, y: 2});
const movedPath = vtrace.getSVGPath(undefined, {x: 10, y: 20});
const scaledAndMovedPath = vtrace.getSVGPath({x: 2, y: 2}, {x: 10, y: 20});
```

Simplification options use this shape:

```typescript
interface SimplifyOptions {
  /** Resolution used while flattening curves. */
  flattenTolerance?: number;
  /** Ramer-Douglas-Peucker epsilon used to simplify flattened points. */
  simplifyTolerance?: number;
}

interface SvgPathSimplifyOptions extends SimplifyOptions {
  /** Remove sub-paths that are fully contained in another sub-path before simplifying. */
  removeInnerSubPaths?: boolean;
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
  /** Alias for `turdSize`, matching the VTracer option name. */
  filterSpeckle?: number;
  /** Whether spline curve fitting is enabled. Defaults to `true`. */
  optCurve?: boolean;
  /** Threshold below which luminance is considered black, from `0` to `255`, or `VTrace.THRESHOLD_AUTO`. */
  threshold?: number;
  /** VTracer color mode. Defaults to `binary`, which thresholds the image before tracing. */
  colorMode?: 'binary' | 'color';
  /** VTracer 1.0 region-forming algorithm. Overrides `colorMode` when set. */
  clustering?: 'color-cluster' | 'bw' | 'watershed';
  /** VTracer 1.0 preset applied before explicit tracing options. */
  preset?: 'bw' | 'poster' | 'photo';
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
  mode?: 'pixel' | 'polygon' | 'spline';
  /** VTracer hierarchical mode. Defaults to `stacked`; use `cutout` to subtract upper layers from lower layers. */
  hierarchical?: 'stacked' | 'cutout';
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
  /** VTracer RGB channel precision. Defaults to `6`; mainly relevant with `colorMode: 'color'`. */
  colorPrecision?: number;
  /** VTracer RGB layer difference threshold. Defaults to `16`; mainly relevant with `colorMode: 'color'`. */
  layerDifference?: number;
  /** VTracer 1.0 curve simplification tolerance in pixels. Disabled by default. */
  simplify?: number;
  /** VTracer decimal places for generated path data. Defaults to `8`. */
  pathPrecision?: number;
  /** Fixed output palette as `#rrggbb` colors. */
  palette?: string[];
  /** Auto-quantize output to at most this many colors. */
  maxColors?: number;
  /** VTracer 1.0 SVG optimization level: `0` off, `1` cleanup, `2` cleanup plus shorthands. */
  optimize?: 0 | 1 | 2;
  /** Fixed threshold passed to VTracer's binary frontend when using `clustering: 'bw'`. */
  binaryThreshold?: number;
  /** Use VTracer's Bradley-Roth adaptive thresholding when using `clustering: 'bw'`. */
  adaptive?: boolean;
  /** Adaptive threshold window size in pixels; `0` lets VTracer choose. */
  adaptiveWindow?: number;
  /** Adaptive threshold sensitivity, as percent below local mean. */
  adaptiveT?: number;
  /** Watershed hierarchy cut level. Higher keeps more regions; defaults to VTracer's `128`. */
  watershedDetail?: number;
}
```

Defaults:

- `turdSize`: `2`
- `filterSpeckle`: uses `turdSize` when omitted
- `optCurve`: `true`
- `threshold`: `VTrace.THRESHOLD_AUTO`
- `colorMode`: `'binary'`
- `clustering`: unset; legacy `colorMode` decides between binary preprocessing and VTracer color clustering
- `preset`: unset
- `blackOnWhite`: `true`
- `color`: `VTrace.COLOR_AUTO`
- `background`: `VTrace.COLOR_TRANSPARENT`
- `width`: source image width
- `height`: source image height
- `mode`: `'spline'`
- `hierarchical`: `'stacked'`
- `cornerThreshold`: `60`
- `lengthThreshold`: `4`
- `maxIterations`: `10`
- `spliceThreshold`: `45`
- `colorPrecision`: `6`
- `layerDifference`: `16`
- `simplify`: unset
- `pathPrecision`: `8`
- `palette`: unset
- `maxColors`: unset
- `optimize`: VTracer default
- `binaryThreshold`: uses `threshold` when it is not `VTrace.THRESHOLD_AUTO`, otherwise VTracer default
- `adaptive`: unset
- `adaptiveWindow`: unset
- `adaptiveT`: unset
- `watershedDetail`: VTracer default

Compatibility notes:

- `optCurve: false` maps tracing to polygon mode instead of spline mode.
- `filterSpeckle` is an alias for `turdSize`; when both are set, `filterSpeckle` is passed to VTracer.
- `threshold` and `blackOnWhite` only affect legacy binary preprocessing when `clustering` is unset and `colorMode` is `'binary'`.
- `clustering` maps to VTracer 1.0 region forming: `'color-cluster'`, `'bw'`, or `'watershed'`. When `clustering` is set, it overrides `colorMode` and passes the original source pixels directly to VTracer.
- `colorMode: 'color'` maps to VTracer 1.0 `clustering: 'color-cluster'` internally. VTracer 1.0 uses a richer color fitting and optimization pipeline than VTracer 0.6.
- Use `clustering: 'bw'` with `binaryThreshold`, or with `adaptive`, `adaptiveWindow`, and `adaptiveT`, to use VTracer 1.0 binary thresholding instead of vtrace's legacy preprocessing.
- Use `clustering: 'watershed'` with `watershedDetail` for VTracer 1.0's edge-aware watershed segmentation. `watershedDetail` is uncapped by VTracer 1.0 alpha.4.

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

The embedded wrapper currently targets `vtracer` `1.0.0-alpha.4` and `visioncortex` `0.9.3`.

## CI and Publishing

GitHub Actions runs build, lint, and test checks on pushes and pull requests targeting `main`.

Publishing is handled by the `Publish` workflow and runs only for version tags such as `v1.2.3` or `v1.2.3-beta.1`.

## License

This project is licensed under the MIT License. For more details, please check the [LICENSE](./LICENSE) file.

VTracer is licensed under MIT OR Apache-2.0. The local WASM wrapper in `rust/vtracer-wasm` depends on the upstream `vtracer` crate.
