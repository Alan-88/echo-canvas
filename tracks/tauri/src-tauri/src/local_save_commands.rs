use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri::Manager;
use whiteboard_backend::persistence::{
    RoomSnapshot, ACTIVE_LOCAL_SAVE_POINTER_FILE, LOCAL_SAVES_DIR_NAME,
};
use whiteboard_backend::snapshot_codec::{
    deserialize_whiteboard_file, serialize_whiteboard_file, SnapshotFormat,
    WHITEBOARD_FILE_EXTENSION,
};
use whiteboard_backend::state::RoomState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSaveSummary {
    id: String,
    name: String,
    date: String,
    layers: usize,
    size: String,
    thumbnail_bg: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSaveLoaded {
    summary: LocalSaveSummary,
    snapshot: RoomSnapshot,
}

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn local_saves_dir(data_root: &Path) -> PathBuf {
    data_root.join(LOCAL_SAVES_DIR_NAME)
}

fn active_pointer_path(data_root: &Path) -> PathBuf {
    data_root.join(ACTIVE_LOCAL_SAVE_POINTER_FILE)
}

fn ensure_local_saves_dir(data_root: &Path) -> Result<PathBuf, String> {
    let dir = local_saves_dir(data_root);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn write_active_save_pointer(data_root: &Path, save_path: &Path) -> Result<(), String> {
    fs::write(active_pointer_path(data_root), save_path.to_string_lossy().as_bytes())
        .map_err(|error| error.to_string())
}

fn parse_snapshot_from_path(path: &Path) -> Result<RoomSnapshot, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let (snapshot, _) =
        deserialize_whiteboard_file::<RoomSnapshot>(&bytes).map_err(|error| error.to_string())?;
    Ok(snapshot)
}

fn format_snapshot_date(snapshot: &RoomSnapshot, path: &Path) -> String {
    if snapshot.saved_at.len() >= 16 {
        return snapshot.saved_at[..16].replace('T', " ");
    }

    let modified = fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .unwrap_or(SystemTime::now());
    let seconds = modified
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("unix:{seconds}")
}

fn format_file_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;

    if bytes < 1024 {
      format!("{bytes} B")
    } else if (bytes as f64) < MB {
      format!("{:.1} KB", bytes as f64 / KB)
    } else {
      format!("{:.1} MB", bytes as f64 / MB)
    }
}

fn pick_thumbnail_bg(seed: &str) -> &'static str {
    const PALETTE: [&str; 6] = [
        "bg-[#FFD6A5]",
        "bg-[#A0C4FF]",
        "bg-[#FFC6FF]",
        "bg-[#CAFFBF]",
        "bg-[#FDFFB6]",
        "bg-[#BDB2FF]",
    ];

    let hash = seed
        .bytes()
        .fold(0usize, |acc, byte| acc.wrapping_mul(31).wrapping_add(byte as usize));
    PALETTE[hash % PALETTE.len()]
}

fn build_local_save_summary(path: &Path) -> Result<LocalSaveSummary, String> {
    let snapshot = parse_snapshot_from_path(path)?;
    let id = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("invalid save filename")?
        .to_string();
    let name = if snapshot.original_room_id.trim().is_empty() {
        id.clone()
    } else {
        snapshot.original_room_id.clone()
    };
    let layers = snapshot
        .canvases
        .values()
        .map(|canvas| canvas.layers.len())
        .sum();
    let size = fs::metadata(path)
        .map(|metadata| format_file_size(metadata.len()))
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(LocalSaveSummary {
        id: id.clone(),
        name,
        date: format_snapshot_date(&snapshot, path),
        layers,
        size,
        thumbnail_bg: pick_thumbnail_bg(&id).to_string(),
    })
}

fn build_empty_snapshot(name: &str) -> RoomSnapshot {
    let room = RoomState::new(name.to_string());
    let mut snapshot = RoomSnapshot::from_room_state_no_token(&room);
    snapshot.original_room_id = name.to_string();
    snapshot
}

fn default_save_name() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("新建画布 {seconds}")
}

fn load_save_from_id(data_root: &Path, save_id: &str) -> Result<(PathBuf, LocalSaveLoaded), String> {
    let save_path = local_saves_dir(data_root).join(format!("{save_id}.{WHITEBOARD_FILE_EXTENSION}"));
    if !save_path.exists() {
        return Err("存档不存在".to_string());
    }

    let snapshot = parse_snapshot_from_path(&save_path)?;
    let summary = build_local_save_summary(&save_path)?;
    Ok((save_path, LocalSaveLoaded { summary, snapshot }))
}

fn normalize_import_name(source_name: Option<&str>, snapshot: &RoomSnapshot) -> String {
    let snapshot_name = snapshot.original_room_id.trim();
    if !snapshot_name.is_empty() {
        return snapshot_name.to_string();
    }

    let source = source_name.unwrap_or_default().trim();
    if !source.is_empty() {
        return source.to_string();
    }

    default_save_name()
}

fn import_snapshot_to_local_save(
    data_root: &Path,
    mut snapshot: RoomSnapshot,
    source_name: Option<String>,
) -> Result<LocalSaveLoaded, String> {
    let saves_dir = ensure_local_saves_dir(data_root)?;
    let save_id = format!(
        "save-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    );
    let save_path = saves_dir.join(format!("{save_id}.{WHITEBOARD_FILE_EXTENSION}"));

    snapshot.original_room_id = normalize_import_name(source_name.as_deref(), &snapshot);
    let bytes =
        serialize_whiteboard_file(&snapshot, SnapshotFormat::Json).map_err(|error| error.to_string())?;
    fs::write(&save_path, bytes).map_err(|error| error.to_string())?;
    write_active_save_pointer(data_root, &save_path)?;

    let summary = build_local_save_summary(&save_path)?;
    Ok(LocalSaveLoaded { summary, snapshot })
}

#[tauri::command]
pub fn list_local_saves(app: AppHandle) -> Result<Vec<LocalSaveSummary>, String> {
    let data_root = app_data_root(&app)?;
    let saves_dir = ensure_local_saves_dir(&data_root)?;
    let mut entries = fs::read_dir(&saves_dir)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some(WHITEBOARD_FILE_EXTENSION))
        .collect::<Vec<_>>();

    entries.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(UNIX_EPOCH)
    });
    entries.reverse();

    entries
        .into_iter()
        .map(|entry| build_local_save_summary(&entry.path()))
        .collect()
}

#[tauri::command]
pub fn create_local_save(app: AppHandle) -> Result<LocalSaveLoaded, String> {
    let data_root = app_data_root(&app)?;
    let snapshot = build_empty_snapshot(&default_save_name());
    import_snapshot_to_local_save(&data_root, snapshot, None)
}

#[tauri::command]
pub fn activate_local_save(app: AppHandle, save_id: String) -> Result<LocalSaveLoaded, String> {
    let data_root = app_data_root(&app)?;
    let (save_path, loaded) = load_save_from_id(&data_root, &save_id)?;
    write_active_save_pointer(&data_root, &save_path)?;
    Ok(loaded)
}

#[tauri::command]
pub fn import_local_save_snapshot(
    app: AppHandle,
    snapshot: RoomSnapshot,
    source_name: Option<String>,
) -> Result<LocalSaveLoaded, String> {
    let data_root = app_data_root(&app)?;
    import_snapshot_to_local_save(&data_root, snapshot, source_name)
}
