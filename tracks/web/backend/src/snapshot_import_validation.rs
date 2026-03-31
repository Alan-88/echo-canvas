#[derive(Debug, Clone, Copy)]
pub struct SnapshotValidationStats {
    pub canvas_count: usize,
    pub total_shapes: usize,
    pub total_images: usize,
    pub total_base64_size: u64,
}

pub fn validate_snapshot_payload(snapshot: &serde_json::Value) -> Result<SnapshotValidationStats, String> {
    if !snapshot.is_object() {
        return Err("快照必须是JSON对象".to_string());
    }

    let obj = snapshot
        .as_object()
        .ok_or_else(|| "快照必须是JSON对象".to_string())?;

    if !obj.contains_key("canvases") {
        return Err("缺少canvases字段".to_string());
    }

    let canvases = obj
        .get("canvases")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "canvases必须是对象".to_string())?;

    if canvases.len() > 100 {
        return Err(format!("Canvas数量过多：{}（最大支持100）", canvases.len()));
    }

    let mut total_shapes = 0;
    let mut total_images = 0;
    let mut total_base64_size = 0u64;

    for (canvas_id, canvas_value) in canvases.iter() {
        let canvas = canvas_value
            .as_object()
            .ok_or_else(|| format!("Canvas {} 必须是对象", canvas_id))?;

        if !canvas.contains_key("layers") {
            return Err(format!("Canvas {} 缺少layers字段", canvas_id));
        }

        let layers = canvas
            .get("layers")
            .and_then(|v| v.as_object())
            .ok_or_else(|| format!("Canvas {} 的layers必须是对象", canvas_id))?;

        if layers.len() > 50 {
            return Err(format!(
                "Canvas {} 的Layer数量过多：{}（最大支持50）",
                canvas_id,
                layers.len()
            ));
        }

        for (layer_id, layer_value) in layers.iter() {
            let layer = layer_value
                .as_object()
                .ok_or_else(|| format!("Layer {} 必须是对象", layer_id))?;

            if !layer.contains_key("actions") {
                return Err(format!("Layer {} 缺少actions字段", layer_id));
            }

            let actions = layer
                .get("actions")
                .and_then(|v| v.as_array())
                .ok_or_else(|| format!("Layer {} 的actions必须是数组", layer_id))?;

            if actions.len() > 10000 {
                return Err(format!(
                    "Layer {} 的Action数量过多：{}（最大支持10000）",
                    layer_id,
                    actions.len()
                ));
            }

            for (idx, action) in actions.iter().enumerate() {
                let Some(obj) = action.as_object() else {
                    continue;
                };

                let action_type = obj.get("type").and_then(|v| v.as_str());
                if action_type != Some("draw") && action_type != Some("Draw") {
                    continue;
                }

                total_shapes += 1;

                let Some(payload) = obj.get("payload").and_then(|v| v.as_object()) else {
                    continue;
                };
                let Some(shape) = payload.get("shape").and_then(|v| v.as_object()) else {
                    continue;
                };
                let shape_type = shape.get("type").and_then(|v| v.as_str());

                if shape_type == Some("image") {
                    total_images += 1;

                    if let Some(data) = shape.get("data").and_then(|v| v.as_object()) {
                        if let Some(src) = data.get("src").and_then(|v| v.as_str()) {
                            if src.is_empty() {
                                continue;
                            }

                            if !src.starts_with("data:image/") {
                                return Err(format!(
                                    "Layer {} Action #{} 的图片src格式错误",
                                    layer_id, idx
                                ));
                            }

                            if let Some(base64_data) = src.split(',').nth(1) {
                                let estimated_size = (base64_data.len() * 3) / 4;
                                total_base64_size += estimated_size as u64;

                                if estimated_size > 3 * 1024 * 1024 {
                                    return Err(format!(
                                        "Layer {} Action #{} 的图片过大：{:.2}MB（最大3MB）",
                                        layer_id,
                                        idx,
                                        estimated_size as f64 / 1024.0 / 1024.0
                                    ));
                                }
                            }
                        }
                    }
                }

                if shape_type == Some("markdown") {
                    if let Some(data) = shape.get("data").and_then(|v| v.as_object()) {
                        if let Some(rendered_image) =
                            data.get("renderedImage").and_then(|v| v.as_str())
                        {
                            if !rendered_image.is_empty()
                                && !rendered_image.starts_with("data:image/")
                            {
                                return Err(format!(
                                    "Layer {} Action #{} 的Markdown renderedImage格式错误",
                                    layer_id, idx
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    if total_base64_size > 50 * 1024 * 1024 {
        return Err(format!(
            "图片总大小过大：{:.2}MB（最大50MB）",
            total_base64_size as f64 / 1024.0 / 1024.0
        ));
    }

    Ok(SnapshotValidationStats {
        canvas_count: canvases.len(),
        total_shapes,
        total_images,
        total_base64_size,
    })
}
