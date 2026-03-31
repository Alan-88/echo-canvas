use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use crate::persistence_snapshot_builder::build_canvas_snapshots;
use crate::resource_snapshot::ResourceSnapshot;
use crate::shape_resource_refs::hydrate_action_from_resources;
use crate::snapshot_codec::{
    deserialize_whiteboard_file, serialize_whiteboard_file, SnapshotFormat,
    WHITEBOARD_FILE_EXTENSION,
};
use crate::state::{CanvasState, LayerState, RoomState};
use whiteboard_shared::Action;

// 持久化用的简化结构（去掉 broadcast channel）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restore_token: Option<String>, // 恢复Token（UUID）- 只有主动保存才有
    pub original_room_id: String, // 原始房间ID
    pub saved_at: String,         // 保存时间（RFC3339）
    pub canvases: IndexMap<Uuid, CanvasSnapshot>,
    #[serde(default)]
    #[serde(skip_serializing_if = "IndexMap::is_empty")]
    pub resources: IndexMap<String, ResourceSnapshot>,
    pub metadata: SaveMetadata, // 元数据
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMetadata {
    #[serde(default)]
    pub canvas_count: usize,
    #[serde(default)]
    pub total_shapes: usize,
    #[serde(default)]
    pub total_resources: usize,
    #[serde(default)]
    pub unique_resources: usize,
    #[serde(default)]
    pub total_resource_bytes: usize,
    #[serde(default)]
    pub unique_resource_bytes: usize,
    #[serde(default)]
    pub snapshot_inline_payloads_stripped: usize,
    #[serde(default)]
    pub snapshot_inline_bytes_stripped: usize,
    #[serde(default = "default_save_count")]
    pub save_count: usize, // 第几次保存（导入时默认为1）
}

fn default_save_count() -> usize {
    1
}

fn normalize_restore_token(restore_token: String) -> Option<String> {
    let trimmed = restore_token.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSnapshot {
    pub id: Uuid,
    pub name: String,
    pub layers: IndexMap<Uuid, LayerSnapshot>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerSnapshot {
    pub id: Uuid,
    pub name: String,
    pub actions: Vec<Action>,
    pub pointer: usize,
}

impl RoomSnapshot {
    // 从 RoomState 创建快照（带Token和元数据）- 用于主动保存
    pub fn from_room_state(room: &RoomState, restore_token: String, save_count: usize) -> Self {
        let snapshot = build_canvas_snapshots(room);

        Self {
            restore_token: Some(restore_token), // 主动保存有token
            original_room_id: room.room_id.clone(),
            saved_at: chrono::Utc::now().to_rfc3339(),
            canvases: snapshot.canvases,
            resources: snapshot.resources,
            metadata: SaveMetadata {
                canvas_count: room.canvases.len(),
                total_shapes: snapshot.total_shapes,
                total_resources: snapshot.resource_stats.total_resources,
                unique_resources: snapshot.resource_stats.unique_resources,
                total_resource_bytes: snapshot.resource_stats.total_resource_bytes,
                unique_resource_bytes: snapshot.resource_stats.unique_resource_bytes,
                snapshot_inline_payloads_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payloads,
                snapshot_inline_bytes_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payload_bytes,
                save_count,
            },
        }
    }

    // 从 RoomState 创建快照（无Token）- 用于紧急保存、导出等
    pub fn from_room_state_no_token(room: &RoomState) -> Self {
        let snapshot = build_canvas_snapshots(room);

        Self {
            restore_token: None, // 紧急保存/导出无token
            original_room_id: room.room_id.clone(),
            saved_at: chrono::Utc::now().to_rfc3339(),
            canvases: snapshot.canvases,
            resources: snapshot.resources,
            metadata: SaveMetadata {
                canvas_count: room.canvases.len(),
                total_shapes: snapshot.total_shapes,
                total_resources: snapshot.resource_stats.total_resources,
                unique_resources: snapshot.resource_stats.unique_resources,
                total_resource_bytes: snapshot.resource_stats.total_resource_bytes,
                unique_resource_bytes: snapshot.resource_stats.unique_resource_bytes,
                snapshot_inline_payloads_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payloads,
                snapshot_inline_bytes_stripped: snapshot
                    .stripped_inline_payload_stats
                    .total_payload_bytes,
                save_count: 1, // 紧急保存默认为1
            },
        }
    }

    // 恢复为 RoomState（使用新的房间ID）
    pub fn to_room_state(&self, new_room_id: String, restore_token: String) -> RoomState {
        let (tx, _rx) = tokio::sync::broadcast::channel(100);
        let associated_restore_token = normalize_restore_token(restore_token);

        let mut canvases = IndexMap::new();

        for (canvas_id, canvas_snapshot) in &self.canvases {
            let mut layers = IndexMap::new();

            for (layer_id, layer_snapshot) in &canvas_snapshot.layers {
                let layer = LayerState {
                    id: layer_snapshot.id,
                    name: layer_snapshot.name.clone(),
                    actions: layer_snapshot
                        .actions
                        .iter()
                        .map(|action| hydrate_action_from_resources(action, &self.resources))
                        .collect(),
                    pointer: layer_snapshot.pointer.min(layer_snapshot.actions.len()),
                };

                layers.insert(
                    *layer_id,
                    std::sync::Arc::new(std::sync::RwLock::new(layer)),
                );
            }

            let canvas = CanvasState {
                id: *canvas_id,
                name: canvas_snapshot.name.clone(),
                layers,
            };

            canvases.insert(
                *canvas_id,
                std::sync::Arc::new(std::sync::RwLock::new(canvas)),
            );
        }

        // 获取当前时间戳（恢复时重置活动时间）
        let last_activity_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs();

        RoomState {
            room_id: new_room_id,
            canvases,
            tx: Some(tx),
            associated_restore_token,
            last_activity_timestamp,
        }
    }
}

// 持久化管理器
#[derive(Debug)]
pub struct PersistenceManager {
    pub data_dir: PathBuf,
    pub snapshot_format: SnapshotFormat,
}

impl PersistenceManager {
    pub fn new() -> Self {
        let data_dir = PathBuf::from("./data/rooms");
        let snapshot_format = SnapshotFormat::from_env();
        // 创建目录（如果不存在）
        fs::create_dir_all(&data_dir).ok();

        println!(
            "[Persistence] Snapshot format: {}",
            snapshot_format.extension()
        );

        Self {
            data_dir,
            snapshot_format,
        }
    }

    fn snapshot_file_path(&self, token: &str, format: SnapshotFormat) -> PathBuf {
        let _ = format;
        self.data_dir
            .join(format!("{token}.{}", WHITEBOARD_FILE_EXTENSION))
    }

    fn find_snapshot_file_for_token(&self, token: &str) -> Option<(PathBuf, SnapshotFormat)> {
        let preferred_path = self.snapshot_file_path(token, self.snapshot_format);
        if preferred_path.exists() {
            return Some((preferred_path, self.snapshot_format));
        }

        None
    }

    fn read_snapshot_by_token(
        &self,
        token: &str,
    ) -> Result<RoomSnapshot, Box<dyn std::error::Error>> {
        let (file_path, format) = self
            .find_snapshot_file_for_token(token)
            .ok_or_else(|| format!("Restore token not found: {token}"))?;
        let bytes = fs::read(file_path)?;
        let (snapshot, _) = deserialize_whiteboard_file::<RoomSnapshot>(&bytes)?;
        let _ = format;
        Ok(snapshot)
    }

    fn parse_token_from_filename(&self, file_name: &str) -> Option<String> {
        file_name
            .strip_suffix(&format!(".{}", WHITEBOARD_FILE_EXTENSION))
            .map(|token| token.to_string())
    }

    // 保存房间（智能处理重复保存）
    pub fn save_room(
        &self,
        room: &RoomState,
    ) -> Result<SaveRoomResponse, Box<dyn std::error::Error>> {
        let (restore_token, is_update, save_count) = match &room.associated_restore_token {
            // 情况1：房间已有关联token，覆盖保存（更新）
            Some(token) => {
                println!("[Persistence] Updating existing save: {}", token);

                // 可选：保留历史版本
                self.backup_if_exists(token)?;

                // 获取当前保存次数
                let current_count = self.get_save_count(token);

                (token.to_string(), true, current_count + 1)
            }
            // 情况2：新房间，生成新token（首次保存）
            None => {
                let new_token = Uuid::new_v4().to_string();
                println!("[Persistence] Creating new save: {}", new_token);
                (new_token, false, 1)
            }
        };

        let snapshot = RoomSnapshot::from_room_state(room, restore_token.clone(), save_count);
        let bytes = serialize_whiteboard_file(&snapshot, self.snapshot_format)?;
        let file_path = self.snapshot_file_path(&restore_token, self.snapshot_format);
        fs::write(file_path, bytes)?;

        println!(
            "[Persistence] Room '{}' saved (token: {}, count: {}, format: {})",
            room.room_id,
            restore_token,
            save_count,
            self.snapshot_format.extension()
        );

        Ok(SaveRoomResponse {
            restore_token,
            saved_at: chrono::Utc::now().to_rfc3339(),
            save_count,
            is_update,
            message: if is_update {
                format!("房间已更新保存（第{}次）", save_count)
            } else {
                "房间已保存！".to_string()
            },
        })
    }

    // 恢复房间（使用token恢复到新房间ID）
    pub fn restore_room(
        &self,
        restore_token: &str,
        new_room_id: String,
    ) -> Result<RoomState, Box<dyn std::error::Error>> {
        let snapshot = self.read_snapshot_by_token(restore_token)?;
        let room = snapshot.to_room_state(new_room_id.clone(), restore_token.to_string());
        println!(
            "[Persistence] Room restored from token '{}' to room '{}'",
            restore_token, new_room_id
        );
        Ok(room)
    }

    // 备份旧版本（可选）
    fn backup_if_exists(&self, token: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some((file_path, format)) = self.find_snapshot_file_for_token(token) {
            let backup_dir = self.data_dir.join("backups");
            fs::create_dir_all(&backup_dir)?;

            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let backup_path = backup_dir.join(format!(
                "{}_backup_{}.{}",
                token,
                timestamp,
                format.extension()
            ));

            fs::copy(&file_path, &backup_path)?;
            println!("[Persistence] Backed up to: {:?}", backup_path);
        }

        Ok(())
    }

    // 获取保存次数
    fn get_save_count(&self, token: &str) -> usize {
        if let Ok(snapshot) = self.read_snapshot_by_token(token) {
            return snapshot.metadata.save_count;
        }

        0
    }

    // 列出所有已保存的房间（返回token列表）
    pub fn list_saved_rooms(&self) -> Vec<SavedRoomInfo> {
        let mut rooms = Vec::new();
        let mut seen_tokens = HashSet::new();

        if let Ok(entries) = fs::read_dir(&self.data_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    let Some(token) = self.parse_token_from_filename(name) else {
                        continue;
                    };
                    if !seen_tokens.insert(token.clone()) {
                        continue;
                    }
                    if let Ok(snapshot) = self.read_snapshot_by_token(&token) {
                        rooms.push(SavedRoomInfo {
                            restore_token: token,
                            original_room_id: snapshot.original_room_id,
                            saved_at: snapshot.saved_at,
                            canvas_count: snapshot.metadata.canvas_count,
                            total_shapes: snapshot.metadata.total_shapes,
                            save_count: snapshot.metadata.save_count,
                        });
                    }
                }
            }
        }

        rooms.sort_by(|a, b| b.saved_at.cmp(&a.saved_at)); // 按时间倒序
        rooms
    }

    // 紧急保存所有活跃房间（无token）
    pub fn emergency_save_all(
        &self,
        rooms: &std::collections::HashMap<String, std::sync::Arc<std::sync::RwLock<RoomState>>>,
    ) {
        let emergency_dir = PathBuf::from("./data/emergency");
        fs::create_dir_all(&emergency_dir).ok();

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");

        for (room_id, room_arc) in rooms {
            if let Ok(room) = room_arc.read() {
                // 使用无token方法创建快照
                let snapshot = RoomSnapshot::from_room_state_no_token(&room);

                if let Ok(bytes) = serialize_whiteboard_file(&snapshot, self.snapshot_format) {
                    let file_path = emergency_dir.join(format!(
                        "{}_{}.{}",
                        room_id,
                        timestamp,
                        WHITEBOARD_FILE_EXTENSION
                    ));
                    if fs::write(file_path, bytes).is_ok() {
                        println!("[Emergency] Saved room '{}' (no token)", room_id);
                    }
                }
            }
        }

        println!(
            "[Emergency] Saved {} active rooms to emergency/ (no tokens)",
            rooms.len()
        );
    }
}

// 保存响应结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveRoomResponse {
    pub restore_token: String,
    pub saved_at: String,
    pub save_count: usize,
    pub is_update: bool,
    pub message: String,
}

// 已保存房间信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedRoomInfo {
    pub restore_token: String,
    pub original_room_id: String,
    pub saved_at: String,
    pub canvas_count: usize,
    pub total_shapes: usize,
    pub save_count: usize,
}
