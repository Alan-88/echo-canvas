use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::persistence::RoomSnapshot;
use crate::snapshot_import_validation::validate_snapshot_payload;
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

fn ensure_new_room_id_is_valid(new_room_id: &str) -> Result<(), ErrorResponse> {
    if !new_room_id.chars().all(|c| c.is_numeric()) || new_room_id.len() != 8 {
        return Err(ErrorResponse {
            error: "新房间ID必须是8位数字".to_string(),
        });
    }

    Ok(())
}

fn ensure_room_id_is_unused(state: &AppState, new_room_id: &str) -> Result<(), ErrorResponse> {
    let rooms = state.rooms.read().unwrap();
    if rooms.contains_key(new_room_id) {
        return Err(ErrorResponse {
            error: format!("房间ID {} 已被使用", new_room_id),
        });
    }

    Ok(())
}

pub async fn check_room_exists_handler(
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Json<RoomExistsResponse> {
    println!("🔍 Check room exists: {}", room_id);

    let rooms = state.rooms.read().unwrap();
    let exists = rooms.contains_key(&room_id);

    Json(RoomExistsResponse { exists, room_id })
}

pub async fn server_info_handler(
    State(_state): State<Arc<AppState>>,
) -> Json<ServerInfoResponse> {
    Json(ServerInfoResponse {
        single_player_room_id: None,
    })
}


pub async fn restore_room_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RestoreRoomRequest>,
) -> Result<Json<RestoreRoomResponse>, (StatusCode, Json<ErrorResponse>)> {
    println!(
        "🔄 Restore room request: token={}, new_room_id={}",
        req.restore_token, req.new_room_id
    );

    ensure_new_room_id_is_valid(&req.new_room_id)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(error)))?;
    ensure_room_id_is_unused(state.as_ref(), &req.new_room_id)
        .map_err(|error| (StatusCode::CONFLICT, Json(error)))?;

    match state
        .persistence
        .restore_room(&req.restore_token, req.new_room_id.clone())
    {
        Ok(room) => {
            println!("✅ Room restored successfully to room_id: {}", room.room_id);

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
        Err(e) => {
            println!("❌ Failed to restore room: {}", e);
            Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("恢复失败: {}", e),
                }),
            ))
        }
    }
}

pub async fn import_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ImportSnapshotRequest>,
) -> Result<Json<ImportSnapshotResponse>, (StatusCode, Json<ErrorResponse>)> {
    println!(
        "📦 Import snapshot request for new_room_id: {}",
        req.new_room_id
    );

    ensure_new_room_id_is_valid(&req.new_room_id)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(error)))?;
    ensure_room_id_is_unused(state.as_ref(), &req.new_room_id)
        .map_err(|error| (StatusCode::CONFLICT, Json(error)))?;

    let snapshot: RoomSnapshot = match serde_json::from_value(req.snapshot) {
        Ok(snapshot) => snapshot,
        Err(e) => {
            println!("❌ Failed to deserialize snapshot: {}", e);
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("数据格式错误: {}", e),
                }),
            ));
        }
    };

    let room = snapshot.to_room_state(req.new_room_id.clone(), String::new());

    println!("✅ Snapshot imported: {} canvases loaded", room.canvases.len());

    let mut rooms = state.rooms.write().unwrap();
    rooms.insert(
        req.new_room_id.clone(),
        Arc::new(std::sync::RwLock::new(room)),
    );

    println!("✅ Room {} created from import", req.new_room_id);

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
    println!(
        "🔍 Validate snapshot request for new_room_id: {}",
        req.new_room_id
    );

    ensure_new_room_id_is_valid(&req.new_room_id)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(error)))?;

    let stats = validate_snapshot_payload(&req.snapshot)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error })))?;

    println!("✅ Snapshot validation passed:");
    println!("   - Canvases: {}", stats.canvas_count);
    println!("   - Total shapes: {}", stats.total_shapes);
    println!("   - Total images: {}", stats.total_images);
    println!(
        "   - Total Base64 size: {:.2}MB",
        stats.total_base64_size as f64 / 1024.0 / 1024.0
    );

    Ok(Json(ValidateSnapshotResponse {
        valid: true,
        message: "文件验证通过".to_string(),
        canvas_count: Some(stats.canvas_count),
        total_shapes: Some(stats.total_shapes),
    }))
}
