use serde::Deserialize;
use vtracer::{convert, ColorImage, ColorMode, Config, Hierarchical};
use visioncortex::PathSimplifyMode;
use wasm_bindgen::prelude::*;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TraceConfig {
    binary: bool,
    mode: TraceMode,
    hierarchical: TraceHierarchical,
    corner_threshold: i32,
    length_threshold: f64,
    max_iterations: usize,
    splice_threshold: i32,
    filter_speckle: usize,
    color_precision: i32,
    layer_difference: i32,
    path_precision: u32,
}

#[derive(Debug, Copy, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TraceMode {
    Pixel,
    Polygon,
    Spline,
}

#[derive(Debug, Copy, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TraceHierarchical {
    Stacked,
    Cutout,
}

#[wasm_bindgen]
pub fn to_svg(
    pixels: Vec<u8>,
    width: usize,
    height: usize,
    config_js: JsValue,
) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();

    let trace_config = serde_wasm_bindgen::from_value::<TraceConfig>(config_js)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let image = ColorImage {
        pixels,
        width,
        height,
    };
    let config = Config {
        color_mode: if trace_config.binary {
            ColorMode::Binary
        } else {
            ColorMode::Color
        },
        hierarchical: match trace_config.hierarchical {
            TraceHierarchical::Stacked => Hierarchical::Stacked,
            TraceHierarchical::Cutout => Hierarchical::Cutout,
        },
        filter_speckle: trace_config.filter_speckle,
        color_precision: trace_config.color_precision,
        layer_difference: trace_config.layer_difference,
        mode: match trace_config.mode {
            TraceMode::Pixel => PathSimplifyMode::None,
            TraceMode::Polygon => PathSimplifyMode::Polygon,
            TraceMode::Spline => PathSimplifyMode::Spline,
        },
        corner_threshold: trace_config.corner_threshold,
        length_threshold: trace_config.length_threshold,
        max_iterations: trace_config.max_iterations,
        splice_threshold: trace_config.splice_threshold,
        path_precision: Some(trace_config.path_precision),
    };

    convert(image, config)
        .map(|svg| svg.to_string())
        .map_err(|error| JsValue::from_str(&error))
}
