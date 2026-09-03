use serde::Deserialize;
use vtracer::{Clustering, Color, ColorImage, Config, FitMode, Hierarchical, Preset};
use wasm_bindgen::prelude::*;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TraceConfig {
    binary: Option<bool>,
    clustering: Option<TraceClustering>,
    preset: Option<TracePreset>,
    mode: Option<TraceMode>,
    hierarchical: Option<TraceHierarchical>,
    corner_threshold: Option<i32>,
    length_threshold: Option<f64>,
    max_iterations: Option<usize>,
    splice_threshold: Option<i32>,
    filter_speckle: Option<usize>,
    color_precision: Option<i32>,
    layer_difference: Option<i32>,
    simplify: Option<f64>,
    path_precision: Option<u32>,
    palette: Option<Vec<String>>,
    max_colors: Option<usize>,
    optimize: Option<u8>,
    binary_threshold: Option<u8>,
    adaptive: Option<bool>,
    adaptive_window: Option<u32>,
    adaptive_t: Option<f64>,
    watershed_detail: Option<u32>,
}

#[derive(Debug, Copy, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum TraceClustering {
    ColorCluster,
    Bw,
    Watershed,
}

#[derive(Debug, Copy, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TracePreset {
    Bw,
    Poster,
    Photo,
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

fn parse_hex_color(token: &str) -> Result<Color, JsValue> {
    let hex = token.strip_prefix('#').unwrap_or(token);
    if hex.len() != 6 {
        return Err(JsValue::from_str(&format!(
            "`{token}` is not a #rrggbb color"
        )));
    }

    let parse_channel = |range: std::ops::Range<usize>| {
        u8::from_str_radix(&hex[range], 16)
            .map_err(|_| JsValue::from_str(&format!("`{token}` is not a #rrggbb color")))
    };

    Ok(Color::new(
        parse_channel(0..2)?,
        parse_channel(2..4)?,
        parse_channel(4..6)?,
    ))
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
    let mut config = match trace_config.preset {
        Some(TracePreset::Bw) => Config::from_preset(Preset::Bw),
        Some(TracePreset::Poster) => Config::from_preset(Preset::Poster),
        Some(TracePreset::Photo) => Config::from_preset(Preset::Photo),
        None => Config::default(),
    };

    config.clustering = match trace_config.clustering {
        Some(TraceClustering::ColorCluster) => Clustering::ColorCluster,
        Some(TraceClustering::Bw) => Clustering::Binary,
        Some(TraceClustering::Watershed) => Clustering::Watershed,
        None if trace_config.binary.unwrap_or(false) => Clustering::Binary,
        None => config.clustering,
    };
    if let Some(hierarchical) = trace_config.hierarchical {
        config.hierarchical = match hierarchical {
            TraceHierarchical::Stacked => Hierarchical::Stacked,
            TraceHierarchical::Cutout => Hierarchical::Cutout,
        };
    }
    if let Some(filter_speckle) = trace_config.filter_speckle {
        config.filter_speckle = filter_speckle;
    }
    if let Some(color_precision) = trace_config.color_precision {
        config.color_precision = color_precision;
    }
    if let Some(layer_difference) = trace_config.layer_difference {
        config.layer_difference = layer_difference;
    }
    if let Some(mode) = trace_config.mode {
        config.mode = match mode {
            TraceMode::Pixel => FitMode::Pixel,
            TraceMode::Polygon => FitMode::Polygon,
            TraceMode::Spline => FitMode::Spline,
        };
    }
    if let Some(corner_threshold) = trace_config.corner_threshold {
        config.corner_threshold = corner_threshold;
    }
    if let Some(length_threshold) = trace_config.length_threshold {
        config.length_threshold = length_threshold;
    }
    if let Some(max_iterations) = trace_config.max_iterations {
        config.max_iterations = max_iterations;
    }
    if let Some(splice_threshold) = trace_config.splice_threshold {
        config.splice_threshold = splice_threshold;
    }
    config.simplify = trace_config.simplify;
    if let Some(path_precision) = trace_config.path_precision {
        config.path_precision = Some(path_precision);
    }
    config.palette = trace_config
        .palette
        .unwrap_or_default()
        .iter()
        .map(|color| parse_hex_color(color))
        .collect::<Result<Vec<_>, _>>()?;
    config.max_colors = trace_config.max_colors;
    if let Some(optimize) = trace_config.optimize {
        config.optimize = optimize;
    }
    if let Some(threshold) = trace_config.binary_threshold {
        config.binary_threshold = threshold;
    }
    if trace_config.adaptive == Some(true)
        || trace_config.adaptive_window.is_some()
        || trace_config.adaptive_t.is_some()
    {
        config.binary_adaptive = true;
    }
    if let Some(window) = trace_config.adaptive_window {
        config.binary_adaptive_window = window;
    }
    if let Some(adaptive_t) = trace_config.adaptive_t {
        config.binary_adaptive_t = adaptive_t;
    }
    if let Some(watershed_detail) = trace_config.watershed_detail {
        config.watershed_detail = watershed_detail;
    }

    config
        .build()
        .map_err(|error| JsValue::from_str(&error.to_string()))?
        .to_svg(&image)
        .map_err(|error| JsValue::from_str(&error.to_string()))
}
