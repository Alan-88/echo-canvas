use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub use crate::room_snapshot::{CanvasSnapshot, LayerSnapshot, RoomSnapshot, SaveMetadata};
use crate::snapshot_codec::{
    deserialize_snapshot, deserialize_whiteboard_file, serialize_snapshot,
    serialize_whiteboard_file, SnapshotFormat, WHITEBOARD_FILE_EXTENSION,
};
use crate::state::RoomState;

pub const LOCAL_SAVES_DIR_NAME: &str = "local-saves";
pub const ACTIVE_LOCAL_SAVE_POINTER_FILE: &str = "active-local-save.txt";

// 持久化管理器
#[derive(Debug)]
pub struct PersistenceManager {
    pub data_root: PathBuf,
    pub data_dir: PathBuf,
    pub snapshot_format: SnapshotFormat,
}

impl PersistenceManager {
    pub fn new() -> Self {
        Self::new_with_root(PathBuf::from("./data"))
    }

    pub fn new_with_root(data_root: PathBuf) -> Self {
        let data_dir = data_root.join("rooms");
        let snapshot_format = SnapshotFormat::from_env();
        fs::create_dir_all(&data_dir).ok();
        fs::create_dir_all(data_root.join("emergency")).ok();

        println!(
            "[Persistence] Snapshot format: {}",
            snapshot_format.extension()
        );

        Self {
            data_root,
            data_dir,
            snapshot_format,
        }
    }

    fn snapshot_file_path(&self, token: &str, format: SnapshotFormat) -> PathBuf {
        self.data_dir
            .join(format!("{token}.{}", format.extension()))
    }

    fn find_snapshot_file_for_token(&self, token: &str) -> Option<(PathBuf, SnapshotFormat)> {
        let preferred_path = self.snapshot_file_path(token, self.snapshot_format);
        if preferred_path.exists() {
            return Some((preferred_path, self.snapshot_format));
        }

        let fallback_format = match self.snapshot_format {
            SnapshotFormat::Json => SnapshotFormat::MessagePack,
            SnapshotFormat::MessagePack => SnapshotFormat::Json,
        };
        let fallback_path = self.snapshot_file_path(token, fallback_format);
        if fallback_path.exists() {
            return Some((fallback_path, fallback_format));
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
        deserialize_snapshot::<RoomSnapshot>(&bytes, format)
    }

    fn read_whiteboard_snapshot_from_path(
        &self,
        path: &PathBuf,
    ) -> Result<(RoomSnapshot, SnapshotFormat), Box<dyn std::error::Error>> {
        let bytes = fs::read(path)?;
        deserialize_whiteboard_file::<RoomSnapshot>(&bytes)
    }

    fn legacy_local_snapshot_file_path(&self) -> PathBuf {
        self.data_root
            .join(format!("single-player.{}", WHITEBOARD_FILE_EXTENSION))
    }

    fn active_local_save_pointer_path(&self) -> PathBuf {
        self.data_root.join(ACTIVE_LOCAL_SAVE_POINTER_FILE)
    }

    fn active_local_save_path(&self) -> Option<PathBuf> {
        let raw = fs::read_to_string(self.active_local_save_pointer_path()).ok()?;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }
        Some(PathBuf::from(trimmed))
    }

    fn local_snapshot_file_path(&self) -> PathBuf {
        self.active_local_save_path()
            .unwrap_or_else(|| self.legacy_local_snapshot_file_path())
    }

    fn find_local_snapshot_file(&self) -> Option<LocalSnapshotLocation> {
        let whiteboard_path = self.local_snapshot_file_path();
        if whiteboard_path.exists() {
            return Some(LocalSnapshotLocation::Whiteboard(whiteboard_path));
        }

        let legacy_path = self.legacy_local_snapshot_file_path();
        if legacy_path.exists() {
            return Some(LocalSnapshotLocation::Whiteboard(legacy_path));
        }

        None
    }

    fn parse_token_from_filename(&self, file_name: &str) -> Option<String> {
        let (token, ext) = file_name.rsplit_once('.')?;
        SnapshotFormat::from_extension(ext)?;
        Some(token.to_string())
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
        let bytes = serialize_snapshot(&snapshot, self.snapshot_format)?;
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

    pub fn save_single_player_room(
        &self,
        room: &RoomState,
    ) -> Result<SaveRoomResponse, Box<dyn std::error::Error>> {
        let existing_save_count = self
            .find_local_snapshot_file()
            .and_then(|location| self.read_local_snapshot(location).ok())
            .map(|snapshot| snapshot.metadata.save_count)
            .unwrap_or(0);

        let mut snapshot = RoomSnapshot::from_room_state_no_token(room);
        snapshot.metadata.save_count = existing_save_count + 1;
        let bytes = serialize_whiteboard_file(&snapshot, self.snapshot_format)?;
        let file_path = self.local_snapshot_file_path();
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(file_path, bytes)?;

        Ok(SaveRoomResponse {
            restore_token: String::new(),
            saved_at: chrono::Utc::now().to_rfc3339(),
            save_count: snapshot.metadata.save_count,
            is_update: existing_save_count > 0,
            message: "本地白板已保存".to_string(),
        })
    }

    pub fn load_single_player_room(
        &self,
        room_id: String,
    ) -> Result<Option<RoomState>, Box<dyn std::error::Error>> {
        let Some(location) = self.find_local_snapshot_file() else {
            return Ok(None);
        };

        let snapshot = self.read_local_snapshot(location)?;
        Ok(Some(snapshot.to_room_state_without_token(room_id)))
    }

    fn read_local_snapshot(
        &self,
        location: LocalSnapshotLocation,
    ) -> Result<RoomSnapshot, Box<dyn std::error::Error>> {
        match location {
            LocalSnapshotLocation::Whiteboard(path) => {
                let (snapshot, _) = self.read_whiteboard_snapshot_from_path(&path)?;
                Ok(snapshot)
            }
        }
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
        let emergency_dir = self.data_root.join("emergency");
        fs::create_dir_all(&emergency_dir).ok();

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");

        for (room_id, room_arc) in rooms {
            if let Ok(room) = room_arc.read() {
                // 使用无token方法创建快照
                let snapshot = RoomSnapshot::from_room_state_no_token(&room);

                if let Ok(bytes) = serialize_snapshot(&snapshot, self.snapshot_format) {
                    let file_path = emergency_dir.join(format!(
                        "{}_{}.{}",
                        room_id,
                        timestamp,
                        self.snapshot_format.extension()
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

enum LocalSnapshotLocation {
    Whiteboard(PathBuf),
}
