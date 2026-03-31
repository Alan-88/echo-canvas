use axum::{extract::State, Json};
use serde::Serialize;
use std::fs;
use std::sync::Arc;
use std::time::SystemTime;

use crate::persistence::SavedRoomInfo;
use crate::state::AppState;

/// 列出所有已保存的房间
pub async fn list_saved_rooms(State(state): State<Arc<AppState>>) -> Json<Vec<SavedRoomInfo>> {
    println!("[Admin] List saved rooms request");

    let rooms = state.persistence.list_saved_rooms();

    println!("[Admin] Found {} saved rooms", rooms.len());

    Json(rooms)
}

/// 获取服务器统计信息
pub async fn server_stats(State(state): State<Arc<AppState>>) -> Json<ServerStats> {
    println!("[Admin] Server stats request");

    let active_rooms = {
        let rooms = state.rooms.read().unwrap();
        rooms.len()
    };

    let saved_rooms = state.persistence.list_saved_rooms().len();

    // 统计紧急保存和备份
    let emergency_count = count_files_in_dir("./data/emergency");
    let backup_count = count_files_in_dir("./data/rooms/backups");

    Json(ServerStats {
        active_rooms,
        saved_rooms,
        emergency_rooms: emergency_count,
        backup_rooms: backup_count,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// 列出所有活跃房间
pub async fn list_active_rooms(State(state): State<Arc<AppState>>) -> Json<Vec<ActiveRoomInfo>> {
    println!("[Admin] List active rooms request");

    let rooms = state.rooms.read().unwrap();
    let mut active_rooms = Vec::new();

    for (room_id, room_arc) in rooms.iter() {
        let room = room_arc.read().unwrap();

        // 统计Canvas和Layer数量
        let mut total_layers = 0;
        for canvas_arc in room.canvases.values() {
            let canvas = canvas_arc.read().unwrap();
            total_layers += canvas.layers.len();
        }

        // 计算空闲时长（分钟）
        let idle_minutes = room.idle_duration() / 60;

        // 在线用户数（暂时无法统计，因为没有连接追踪）
        let online_users = 0; // TODO: 需要扩展RoomState追踪WebSocket连接数

        active_rooms.push(ActiveRoomInfo {
            room_id: room_id.clone(),
            canvas_count: room.canvases.len(),
            layer_count: total_layers,
            online_users,
            idle_minutes,
            has_restore_token: room.associated_restore_token.is_some(),
        });
    }

    println!("[Admin] Found {} active rooms", active_rooms.len());

    Json(active_rooms)
}

/// 列出所有紧急保存的房间
pub async fn list_emergency_rooms(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<EmergencyRoomInfo>> {
    println!("[Admin] List emergency rooms request");

    let emergency_dir = state.persistence.data_dir.join("emergency");
    let mut emergency_rooms = Vec::new();

    if let Ok(entries) = fs::read_dir(&emergency_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();

                    // 解析文件名: {room_id}_{timestamp}.json
                    if let Some(room_id) = parse_emergency_filename(&filename) {
                        let file_size = metadata.len();
                        let saved_at = metadata
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);

                        emergency_rooms.push(EmergencyRoomInfo {
                            filename,
                            original_room_id: room_id,
                            file_size,
                            saved_at,
                        });
                    }
                }
            }
        }
    }

    println!("[Admin] Found {} emergency rooms", emergency_rooms.len());

    Json(emergency_rooms)
}

/// 列出所有备份文件
pub async fn list_backups(State(state): State<Arc<AppState>>) -> Json<Vec<BackupInfo>> {
    println!("[Admin] List backups request");

    let backup_dir = state.persistence.data_dir.join("backups");
    let mut backups = Vec::new();

    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();

                    // 解析文件名: {token}_backup_{timestamp}.json
                    if let Some((token, timestamp)) = parse_backup_filename(&filename) {
                        let file_size = metadata.len();

                        backups.push(BackupInfo {
                            filename,
                            restore_token: token,
                            backup_timestamp: timestamp,
                            file_size,
                        });
                    }
                }
            }
        }
    }

    // 按时间戳倒序排列（最新的在前）
    backups.sort_by(|a, b| b.backup_timestamp.cmp(&a.backup_timestamp));

    println!("[Admin] Found {} backups", backups.len());

    Json(backups)
}

// 辅助函数：统计目录中的文件数
fn count_files_in_dir(path: &str) -> usize {
    fs::read_dir(path)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().ok().map(|t| t.is_file()).unwrap_or(false))
                .count()
        })
        .unwrap_or(0)
}

fn strip_supported_snapshot_extension(filename: &str) -> Option<&str> {
    filename
        .strip_suffix(".json")
        .or_else(|| filename.strip_suffix(".msgpack"))
}

// 解析紧急保存文件名: {room_id}_{timestamp}.{json|msgpack}
fn parse_emergency_filename(filename: &str) -> Option<String> {
    let name = strip_supported_snapshot_extension(filename)?;
    let parts: Vec<&str> = name.split('_').collect();

    if parts.len() >= 2 {
        Some(parts[0].to_string())
    } else {
        None
    }
}

// 解析备份文件名: {token}_backup_{timestamp}.{json|msgpack}
fn parse_backup_filename(filename: &str) -> Option<(String, String)> {
    let name = strip_supported_snapshot_extension(filename)?;

    // 查找 "_backup_" 分隔符
    if let Some(backup_pos) = name.find("_backup_") {
        let token = name[..backup_pos].to_string();
        let timestamp = name[backup_pos + 8..].to_string();
        Some((token, timestamp))
    } else {
        None
    }
}

/// 服务器统计信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStats {
    pub active_rooms: usize,
    pub saved_rooms: usize,
    pub emergency_rooms: usize,
    pub backup_rooms: usize,
    pub version: String,
}

/// 活跃房间信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRoomInfo {
    pub room_id: String,
    pub canvas_count: usize,
    pub layer_count: usize,
    pub online_users: usize,
    pub idle_minutes: u64,
    pub has_restore_token: bool,
}

/// 紧急保存房间信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmergencyRoomInfo {
    pub filename: String,
    pub original_room_id: String,
    pub file_size: u64,
    pub saved_at: u64, // Unix timestamp
}

/// 备份文件信息
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub filename: String,
    pub restore_token: String,
    pub backup_timestamp: String,
    pub file_size: u64,
}
