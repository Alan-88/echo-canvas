use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfoResponse {
    pub single_player_room_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRoomRequest {
    pub restore_token: String,
    pub new_room_id: String,
}

#[derive(Debug, Serialize)]
pub struct RestoreRoomResponse {
    pub success: bool,
    pub room_id: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomExistsResponse {
    pub exists: bool,
    pub room_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSnapshotRequest {
    pub snapshot: serde_json::Value,
    pub new_room_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSnapshotResponse {
    pub valid: bool,
    pub message: String,
    pub canvas_count: Option<usize>,
    pub total_shapes: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSnapshotRequest {
    pub snapshot: serde_json::Value,
    pub new_room_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSnapshotResponse {
    pub success: bool,
    pub room_id: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSinglePlayerSnapshotRequest {
    pub snapshot: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSinglePlayerSnapshotResponse {
    pub success: bool,
    pub room_id: String,
    pub message: String,
}

pub async fn check_room_exists_handler(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<RoomExistsResponse> {
    let rooms = state.rooms.read().unwrap();
    Json(RoomExistsResponse {
        exists: rooms.contains_key(&room_id),
        room_id,
    })
}

pub async fn server_info_handler(
    State(state): State<Arc<AppState>>,
) -> Json<ServerInfoResponse> {
    Json(ServerInfoResponse {
        single_player_room_id: state.single_player_room_id.clone(),
    })
}

pub async fn restore_room_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RestoreRoomRequest>,
) -> Result<Json<RestoreRoomResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !req.new_room_id.chars().all(|c| c.is_numeric()) || req.new_room_id.len() != 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "新房间ID必须是8位数字".to_string(),
            }),
        ));
    }

    {
        let rooms = state.rooms.read().unwrap();
        if rooms.contains_key(&req.new_room_id) {
            return Err((
                StatusCode::CONFLICT,
                Json(ErrorResponse {
                    error: format!("房间ID {} 已被使用", req.new_room_id),
                }),
            ));
        }
    }

    match state
        .persistence
        .restore_room(&req.restore_token, req.new_room_id.clone())
    {
        Ok(room) => {
            let mut rooms = state.rooms.write().unwrap();
            rooms.insert(
                req.new_room_id.clone(),
                Arc::new(std::sync::RwLock::new(room)),
            );

            Ok(Json(RestoreRoomResponse {
                success: true,
                room_id: req.new_room_id,
                message: "房间恢复成功".to_string(),
            }))
        }
        Err(e) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("恢复失败: {}", e),
            }),
        )),
    }
}

pub async fn import_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ImportSnapshotRequest>,
) -> Result<Json<ImportSnapshotResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !req.new_room_id.chars().all(|c| c.is_numeric()) || req.new_room_id.len() != 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "新房间ID必须是8位数字".to_string(),
            }),
        ));
    }

    {
        let rooms = state.rooms.read().unwrap();
        if rooms.contains_key(&req.new_room_id) {
            return Err((
                StatusCode::CONFLICT,
                Json(ErrorResponse {
                    error: format!("房间ID {} 已被使用", req.new_room_id),
                }),
            ));
        }
    }

    let snapshot: crate::persistence::RoomSnapshot = serde_json::from_value(req.snapshot).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("数据格式错误: {}", e),
            }),
        )
    })?;

    let room = snapshot.to_room_state_without_token(req.new_room_id.clone());
    let mut rooms = state.rooms.write().unwrap();
    rooms.insert(
        req.new_room_id.clone(),
        Arc::new(std::sync::RwLock::new(room)),
    );

    Ok(Json(ImportSnapshotResponse {
        success: true,
        room_id: req.new_room_id,
        message: "房间导入成功".to_string(),
    }))
}

pub async fn validate_snapshot_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ValidateSnapshotRequest>,
) -> Result<Json<ValidateSnapshotResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !req.new_room_id.chars().all(|c| c.is_numeric()) || req.new_room_id.len() != 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "新房间ID必须是8位数字".to_string(),
            }),
        ));
    }

    let snapshot = &req.snapshot;
    if !snapshot.is_object() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "快照必须是JSON对象".to_string(),
            }),
        ));
    }

    let obj = snapshot.as_object().unwrap();
    if !obj.contains_key("canvases") {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "缺少canvases字段".to_string(),
            }),
        ));
    }

    let canvases = obj
        .get("canvases")
        .and_then(|v| v.as_object())
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "canvases必须是对象".to_string(),
                }),
            )
        })?;

    if canvases.len() > 100 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Canvas数量过多：{}（最大支持100）", canvases.len()),
            }),
        ));
    }

    let mut total_shapes = 0;
    let mut total_base64_size = 0u64;

    for (canvas_id, canvas_value) in canvases.iter() {
        let canvas = canvas_value.as_object().ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Canvas {} 必须是对象", canvas_id),
                }),
            )
        })?;

        let layers = canvas
            .get("layers")
            .and_then(|v| v.as_object())
            .ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: format!("Canvas {} 的layers必须是对象", canvas_id),
                    }),
                )
            })?;

        if layers.len() > 50 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!(
                        "Canvas {} 的Layer数量过多：{}（最大支持50）",
                        canvas_id,
                        layers.len()
                    ),
                }),
            ));
        }

        for (layer_id, layer_value) in layers.iter() {
            let layer = layer_value.as_object().ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: format!("Layer {} 必须是对象", layer_id),
                    }),
                )
            })?;

            let actions = layer
                .get("actions")
                .and_then(|v| v.as_array())
                .ok_or_else(|| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!("Layer {} 的actions必须是数组", layer_id),
                        }),
                    )
                })?;

            if actions.len() > 10000 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: format!(
                            "Layer {} 的Action数量过多：{}（最大支持10000）",
                            layer_id,
                            actions.len()
                        ),
                    }),
                ));
            }

            for (idx, action) in actions.iter().enumerate() {
                if let Some(obj) = action.as_object() {
                    let action_type = obj.get("type").and_then(|v| v.as_str());
                    if action_type == Some("draw") || action_type == Some("Draw") {
                        total_shapes += 1;
                        if let Some(shape) = obj
                            .get("payload")
                            .and_then(|v| v.as_object())
                            .and_then(|payload| payload.get("shape"))
                            .and_then(|v| v.as_object())
                        {
                            let shape_type = shape.get("type").and_then(|v| v.as_str());
                            if shape_type == Some("image") {
                                if let Some(src) = shape
                                    .get("data")
                                    .and_then(|v| v.as_object())
                                    .and_then(|data| data.get("src"))
                                    .and_then(|v| v.as_str())
                                {
                                    if !src.is_empty() {
                                        if !src.starts_with("data:image/") {
                                            return Err((
                                                StatusCode::BAD_REQUEST,
                                                Json(ErrorResponse {
                                                    error: format!(
                                                        "Layer {} Action #{} 的图片src格式错误",
                                                        layer_id, idx
                                                    ),
                                                }),
                                            ));
                                        }

                                        if let Some(base64_data) = src.split(',').nth(1) {
                                            let estimated_size = (base64_data.len() * 3) / 4;
                                            total_base64_size += estimated_size as u64;
                                            if estimated_size > 3 * 1024 * 1024 {
                                                return Err((
                                                    StatusCode::BAD_REQUEST,
                                                    Json(ErrorResponse {
                                                        error: format!(
                                                            "Layer {} Action #{} 的图片过大：{:.2}MB（最大3MB）",
                                                            layer_id,
                                                            idx,
                                                            estimated_size as f64 / 1024.0 / 1024.0
                                                        ),
                                                    }),
                                                ));
                                            }
                                        }
                                    }
                                }
                            }

                            if shape_type == Some("markdown") {
                                if let Some(rendered_image) = shape
                                    .get("data")
                                    .and_then(|v| v.as_object())
                                    .and_then(|data| data.get("renderedImage"))
                                    .and_then(|v| v.as_str())
                                {
                                    if !rendered_image.is_empty()
                                        && !rendered_image.starts_with("data:image/")
                                    {
                                        return Err((
                                            StatusCode::BAD_REQUEST,
                                            Json(ErrorResponse {
                                                error: format!(
                                                    "Layer {} Action #{} 的Markdown renderedImage格式错误",
                                                    layer_id, idx
                                                ),
                                            }),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if total_base64_size > 50 * 1024 * 1024 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "图片总大小过大：{:.2}MB（最大50MB）",
                    total_base64_size as f64 / 1024.0 / 1024.0
                ),
            }),
        ));
    }

    Ok(Json(ValidateSnapshotResponse {
        valid: true,
        message: "文件验证通过".to_string(),
        canvas_count: Some(canvases.len()),
        total_shapes: Some(total_shapes),
    }))
}

pub async fn load_single_player_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoadSinglePlayerSnapshotRequest>,
) -> Result<Json<LoadSinglePlayerSnapshotResponse>, (StatusCode, Json<ErrorResponse>)> {
    let Some(room_id) = state.single_player_room_id.clone() else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "当前服务未启用单机模式".to_string(),
            }),
        ));
    };

    let snapshot: crate::persistence::RoomSnapshot = serde_json::from_value(req.snapshot).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("数据格式错误: {}", e),
            }),
        )
    })?;

    let room = snapshot.to_room_state_without_token(room_id.clone());
    if let Err(error) = state.persistence.save_single_player_room(&room) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("写入本地快照失败: {}", error),
            }),
        ));
    }

    let mut rooms = state.rooms.write().unwrap();
    rooms.insert(room_id.clone(), Arc::new(std::sync::RwLock::new(room)));

    Ok(Json(LoadSinglePlayerSnapshotResponse {
        success: true,
        room_id,
        message: "单机白板已从文件载入".to_string(),
    }))
}
