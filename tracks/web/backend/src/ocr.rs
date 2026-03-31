use axum::{http::StatusCode, Json};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{env, time::Duration};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLatexRequest {
    pub image_data_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLatexResponse {
    pub success: bool,
    pub latex: String,
    pub confidence: Option<f64>,
    pub provider: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OcrErrorResponse {
    pub error: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OcrRequestFormat {
    Auto,
    Custom,
    OpenAiChat,
}

impl OcrRequestFormat {
    fn from_env(raw: Option<String>) -> Self {
        match raw
            .as_deref()
            .unwrap_or("auto")
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "custom" => Self::Custom,
            "openai" | "openai_chat" | "openai-chat" | "chat_completions" | "chat-completions" => {
                Self::OpenAiChat
            }
            _ => Self::Auto,
        }
    }
}

struct OcrConfig {
    base_url: String,
    api_key: String,
    auth_header: String,
    auth_scheme: String,
    model: Option<String>,
    request_format: OcrRequestFormat,
    timeout_ms: u64,
    provider: String,
}

const DEFAULT_TIMEOUT_MS: u64 = 15_000;

fn read_ocr_config() -> Result<OcrConfig, String> {
    let base_url = env::var("OCR_BASE_URL").map_err(|_| "缺少环境变量 OCR_BASE_URL".to_string())?;
    let api_key = env::var("OCR_API_KEY").map_err(|_| "缺少环境变量 OCR_API_KEY".to_string())?;
    let auth_header = env::var("OCR_AUTH_HEADER").unwrap_or_else(|_| "Authorization".to_string());
    let auth_scheme = env::var("OCR_AUTH_SCHEME").unwrap_or_else(|_| "Bearer".to_string());
    let model = env::var("OCR_MODEL")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let request_format = OcrRequestFormat::from_env(env::var("OCR_REQUEST_FORMAT").ok());
    let timeout_ms = env::var("OCR_TIMEOUT_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_TIMEOUT_MS);
    let provider = env::var("OCR_PROVIDER").unwrap_or_else(|_| "custom".to_string());

    Ok(OcrConfig {
        base_url,
        api_key,
        auth_header,
        auth_scheme,
        model,
        request_format,
        timeout_ms,
        provider,
    })
}

fn split_data_url(raw: &str) -> Result<(String, String), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("imageDataUrl 不能为空".to_string());
    }

    if let Some(rest) = trimmed.strip_prefix("data:") {
        if let Some((meta, data)) = rest.split_once(',') {
            if data.trim().is_empty() {
                return Err("imageDataUrl 缺少数据内容".to_string());
            }
            let mime_type = meta
                .split(';')
                .next()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("image/png")
                .to_string();
            return Ok((mime_type, data.trim().to_string()));
        }
        return Err("imageDataUrl 格式不合法".to_string());
    }

    Ok(("image/png".to_string(), trimmed.to_string()))
}

fn normalize_latex(raw: &str) -> Option<String> {
    let mut text = raw.trim().to_string();
    if text.is_empty() {
        return None;
    }

    if text.starts_with("```") {
        let mut lines: Vec<&str> = text.lines().collect();
        if !lines.is_empty() {
            lines.remove(0);
        }
        if matches!(lines.last(), Some(line) if line.trim_start().starts_with("```")) {
            lines.pop();
        }
        text = lines.join("\n").trim().to_string();
    }

    if text.starts_with("$$") && text.ends_with("$$") && text.len() > 4 {
        text = text[2..text.len() - 2].trim().to_string();
    }

    if text.starts_with("\\[") && text.ends_with("\\]") && text.len() > 4 {
        text = text[2..text.len() - 2].trim().to_string();
    }

    if text.starts_with("\\(") && text.ends_with("\\)") && text.len() > 4 {
        text = text[2..text.len() - 2].trim().to_string();
    }

    if text.is_empty() {
        return None;
    }

    Some(text)
}

fn resolve_request_format(config: &OcrConfig) -> OcrRequestFormat {
    if config.request_format != OcrRequestFormat::Auto {
        return config.request_format;
    }

    let normalized = config
        .base_url
        .trim()
        .trim_end_matches('/')
        .to_ascii_lowercase();
    if normalized.ends_with("/v1") || normalized.contains("/chat/completions") {
        OcrRequestFormat::OpenAiChat
    } else {
        OcrRequestFormat::Custom
    }
}

fn resolve_upstream_url(base_url: &str, request_format: OcrRequestFormat) -> String {
    let normalized = base_url.trim().trim_end_matches('/');
    if request_format != OcrRequestFormat::OpenAiChat {
        return normalized.to_string();
    }

    let normalized_lower = normalized.to_ascii_lowercase();
    if normalized_lower.contains("/chat/completions") {
        normalized.to_string()
    } else if normalized_lower.ends_with("/v1") {
        format!("{}/chat/completions", normalized)
    } else {
        normalized.to_string()
    }
}

fn build_upstream_payload(
    config: &OcrConfig,
    request_format: OcrRequestFormat,
    mime_type: &str,
    image_base64: &str,
) -> Result<Value, String> {
    match request_format {
        OcrRequestFormat::Custom | OcrRequestFormat::Auto => {
            let mut payload = serde_json::Map::new();
            payload.insert("image".to_string(), json!(image_base64));
            payload.insert("mimeType".to_string(), json!(mime_type));
            payload.insert("task".to_string(), json!("latex"));
            if let Some(model) = &config.model {
                payload.insert("model".to_string(), json!(model));
            }
            Ok(Value::Object(payload))
        }
        OcrRequestFormat::OpenAiChat => {
            let model = config
                .model
                .as_ref()
                .ok_or_else(|| "OCR_MODEL 不能为空：OpenAI 兼容请求需要显式 model".to_string())?;
            let image_data_url = format!("data:{};base64,{}", mime_type, image_base64);
            Ok(json!({
                "model": model,
                "temperature": 0,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an OCR assistant for handwritten math. Return only LaTeX without markdown fences."
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Recognize the handwritten formula in the image and return only LaTeX."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data_url
                                }
                            }
                        ]
                    }
                ]
            }))
        }
    }
}

fn extract_text_from_value(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }

    if let Some(array) = value.as_array() {
        let mut parts: Vec<String> = Vec::new();
        for item in array {
            if let Some(text) = extract_text_from_value(item) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
                continue;
            }
            if let Some(text) = item.get("text").and_then(Value::as_str) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }
        }
        if parts.is_empty() {
            return None;
        }
        return Some(parts.join("\n"));
    }

    if let Some(object) = value.as_object() {
        if let Some(text) = object.get("text").and_then(Value::as_str) {
            return Some(text.to_string());
        }
        if let Some(latex) = object.get("latex").and_then(Value::as_str) {
            return Some(latex.to_string());
        }
        if let Some(content) = object.get("content") {
            if let Some(text) = extract_text_from_value(content) {
                return Some(text);
            }
        }
    }

    None
}

fn extract_latex_from_value(value: &Value) -> Option<String> {
    let candidates = [
        value.pointer("/latex"),
        value.pointer("/result/latex"),
        value.pointer("/data/latex"),
        value.pointer("/choices/0/message/content"),
        value.pointer("/choices/0/text"),
        value.pointer("/output_text"),
        value.pointer("/output/0/content"),
        value.pointer("/output/0/content/0/text"),
        value.pointer("/text"),
        value.pointer("/result/text"),
        value.pointer("/data/text"),
    ];

    for candidate in candidates {
        if let Some(text) = candidate.and_then(extract_text_from_value) {
            if let Some(latex) = normalize_latex(&text) {
                return Some(latex);
            }
        }
    }

    None
}

fn extract_confidence_from_value(value: &Value) -> Option<f64> {
    let candidates = [
        value.pointer("/confidence"),
        value.pointer("/score"),
        value.pointer("/result/confidence"),
        value.pointer("/result/score"),
        value.pointer("/data/confidence"),
        value.pointer("/data/score"),
    ];

    candidates
        .iter()
        .filter_map(|item| item.and_then(|value| value.as_f64()))
        .next()
}

fn build_auth_header_value(config: &OcrConfig) -> String {
    let scheme = config.auth_scheme.trim();
    if scheme.is_empty() || scheme.eq_ignore_ascii_case("none") {
        return config.api_key.clone();
    }
    format!("{} {}", scheme, config.api_key)
}

pub async fn recognize_latex_handler(
    Json(req): Json<OcrLatexRequest>,
) -> Result<Json<OcrLatexResponse>, (StatusCode, Json<OcrErrorResponse>)> {
    let config = read_ocr_config().map_err(|error| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OcrErrorResponse { error }),
        )
    })?;

    let (mime_type, image_base64) = split_data_url(&req.image_data_url)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(OcrErrorResponse { error })))?;

    let request_format = resolve_request_format(&config);
    let upstream_url = resolve_upstream_url(&config.base_url, request_format);
    let upstream_payload =
        build_upstream_payload(&config, request_format, &mime_type, &image_base64).map_err(
            |error| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(OcrErrorResponse { error }),
                )
            },
        )?;

    let client = Client::builder()
        .timeout(Duration::from_millis(config.timeout_ms))
        .build()
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OcrErrorResponse {
                    error: format!("初始化 OCR 客户端失败: {}", error),
                }),
            )
        })?;

    let upstream_response = client
        .post(&upstream_url)
        .header(&config.auth_header, build_auth_header_value(&config))
        .json(&upstream_payload)
        .send()
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(OcrErrorResponse {
                    error: format!("请求 OCR 服务失败: {}", error),
                }),
            )
        })?;

    let upstream_status = upstream_response.status();
    let upstream_text = upstream_response.text().await.map_err(|error| {
        (
            StatusCode::BAD_GATEWAY,
            Json(OcrErrorResponse {
                error: format!("读取 OCR 返回失败: {}", error),
            }),
        )
    })?;

    if !upstream_status.is_success() {
        let message = if upstream_text.trim().is_empty() {
            format!("OCR 服务返回状态码 {}", upstream_status.as_u16())
        } else {
            format!(
                "OCR 服务返回状态码 {}: {}",
                upstream_status.as_u16(),
                upstream_text
            )
        };
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(OcrErrorResponse { error: message }),
        ));
    }

    let parsed = serde_json::from_str::<Value>(&upstream_text).ok();
    let latex = parsed
        .as_ref()
        .and_then(extract_latex_from_value)
        .or_else(|| normalize_latex(&upstream_text))
        .ok_or_else(|| {
            (
                StatusCode::BAD_GATEWAY,
                Json(OcrErrorResponse {
                    error: "OCR 返回中未找到可用的 LaTeX 内容".to_string(),
                }),
            )
        })?;

    let confidence = parsed.as_ref().and_then(extract_confidence_from_value);

    Ok(Json(OcrLatexResponse {
        success: true,
        latex,
        confidence,
        provider: config.provider,
        message: "OCR 识别成功".to_string(),
    }))
}
