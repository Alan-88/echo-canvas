use crate::layer_action_normalizer::normalize_layer_action;
use crate::layer_snapshot_replay::compute_visible_shapes_with_order;
use crate::shape_policy::normalize_erase_shape_ids;
use crate::shape_resource_refs::fill_shape_resources_if_missing;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::broadcast;
use uuid::Uuid;
use whiteboard_shared::{Action, ServerMessage, ShapeData};

// ---------------------------------------------------------
// 配置常量
// ---------------------------------------------------------

/// 触发快照压缩的 actions 数量阈值
const MAX_ACTIONS_BEFORE_COMPRESSION: usize = 1000;

/// 空闲房间自动卸载超时时间（秒）
const IDLE_ROOM_TIMEOUT_SECS: u64 = 7200; // 2小时

/// 空闲房间检查间隔（秒）
const IDLE_ROOM_CHECK_INTERVAL_SECS: u64 = 300; // 5分钟

// ---------------------------------------------------------
// 三级数据结构：Room -> Canvas -> Layer
// ---------------------------------------------------------

// 单个图层的状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerState {
    pub id: Uuid,
    pub name: String,
    pub actions: Vec<Action>,
    pub pointer: usize,
}

impl LayerState {
    pub fn new(id: Uuid, name: String) -> Self {
        Self {
            id,
            name,
            actions: Vec::new(),
            pointer: 0,
        }
    }

    // 核心逻辑：处理动作
    pub fn apply_action(&mut self, action: Action) {
        let visible_shapes = self.compute_visible_shapes();
        let processed_action = normalize_layer_action(action, &visible_shapes);

        if matches!(&processed_action, Action::Erase { shape_ids, .. } if shape_ids.is_empty()) {
            return;
        }

        match processed_action {
            Action::Draw { .. }
            | Action::Erase { .. }
            | Action::Update { .. }
            | Action::BatchUpdate { .. }
            | Action::Reorder { .. }
            | Action::Clear => {
                // 1. 历史重写 (History Rewrite)
                if self.pointer < self.actions.len() {
                    self.actions.truncate(self.pointer);
                }

                // 2. 压栈 & 移动指针
                self.actions.push(processed_action);
                self.pointer += 1;

                // 3. 检查是否需要压缩
                if self.actions.len() > MAX_ACTIONS_BEFORE_COMPRESSION {
                    self.compress_snapshot();
                }
            }
            Action::Undo => {
                if self.pointer > 0 {
                    self.pointer -= 1;
                }
            }
            Action::Redo => {
                if self.pointer < self.actions.len() {
                    self.pointer += 1;
                }
            }
        }
    }

    /// 计算当前可见的所有图形
    /// 遍历 actions[0..pointer]，模拟执行得到最终状态
    fn compute_visible_shapes(&self) -> HashMap<Uuid, ShapeData> {
        let mut shapes: HashMap<Uuid, ShapeData> = HashMap::new();

        for action in &self.actions[0..self.pointer] {
            match action {
                Action::Draw { id, shape } => {
                    shapes.insert(*id, shape.clone());
                }
                Action::Erase {
                    shape_ids,
                    force_all_types,
                } => {
                    let filtered_shape_ids =
                        normalize_erase_shape_ids(shape_ids, &shapes, *force_all_types);
                    for id in filtered_shape_ids {
                        shapes.remove(&id);
                    }
                }
                Action::Update { id, new_shape, .. } => {
                    let updated_shape = fill_shape_resources_if_missing(id, new_shape, &shapes);
                    shapes.insert(*id, updated_shape);
                }
                Action::BatchUpdate { updates } => {
                    for update in updates {
                        let updated_shape =
                            fill_shape_resources_if_missing(&update.id, &update.new_shape, &shapes);
                        shapes.insert(update.id, updated_shape);
                    }
                }
                Action::Reorder { .. } => {
                    // 当前服务端可见态仍以 HashMap 表示，不承载顺序；
                    // Reorder 主要用于保留历史语义，由前端重放时应用顺序。
                }
                Action::Clear => {
                    shapes.clear();
                }
                _ => {} // Undo/Redo 不应该在这里出现
            }
        }

        shapes
    }

    /// 快照压缩：将历史压缩为当前可见图形
    /// 压缩后，无法 undo 到压缩点之前
    fn compress_snapshot(&mut self) {
        let (visible_order, mut visible_shapes) =
            compute_visible_shapes_with_order(&self.actions, self.pointer);

        println!(
            "[Compression] Layer '{}': {} actions -> {} shapes",
            self.name,
            self.actions.len(),
            visible_order.len()
        );

        // 重建 actions 数组
        let mut new_actions = Vec::with_capacity(visible_order.len());

        for id in visible_order {
            if let Some(shape) = visible_shapes.remove(&id) {
                new_actions.push(Action::Draw { id, shape });
            }
        }

        // 替换原数组
        self.actions = new_actions;
        self.pointer = self.actions.len();

        println!(
            "[Compression] Layer '{}': compressed to {} actions",
            self.name,
            self.actions.len()
        );
    }
}

// Canvas 状态（包含多个 Layer）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasState {
    pub id: Uuid,
    pub name: String,
    #[serde(skip)]
    pub layers: IndexMap<Uuid, Arc<RwLock<LayerState>>>,
}

impl CanvasState {
    pub fn new(id: Uuid, name: String) -> Self {
        // 创建默认图层
        let default_layer_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001")
            .expect("Invalid default layer UUID");
        let default_layer = Arc::new(RwLock::new(LayerState::new(
            default_layer_id,
            "Layer 1".to_string(),
        )));

        let mut layers = IndexMap::new();
        layers.insert(default_layer_id, default_layer);

        Self { id, name, layers }
    }

    pub fn get_or_create_layer(&mut self, layer_id: Uuid, name: String) -> Arc<RwLock<LayerState>> {
        self.layers
            .entry(layer_id)
            .or_insert_with(|| Arc::new(RwLock::new(LayerState::new(layer_id, name))))
            .clone()
    }

    pub fn delete_layer(&mut self, layer_id: Uuid) -> bool {
        self.layers.shift_remove(&layer_id).is_some()
    }
}

// Room 状态（包含多个 Canvas）
#[derive(Debug, Serialize, Deserialize)]
pub struct RoomState {
    pub room_id: String, // 原始 8 位房间号
    #[serde(skip)]
    pub canvases: IndexMap<Uuid, Arc<RwLock<CanvasState>>>,
    #[serde(skip)]
    pub tx: Option<broadcast::Sender<ServerMessage>>,
    #[serde(skip)]
    pub associated_restore_token: Option<String>, // 关联的恢复Token（如果有）
    #[serde(skip)]
    pub last_activity_timestamp: u64, // 最后活动时间（Unix时间戳）
}

impl RoomState {
    pub fn new(room_id: String) -> Self {
        let (tx, _rx) = broadcast::channel(100);

        // 创建默认 Canvas
        let default_canvas_id = Uuid::parse_str("00000000-0000-0000-0000-000000000010")
            .expect("Invalid default canvas UUID");
        let default_canvas = Arc::new(RwLock::new(CanvasState::new(
            default_canvas_id,
            "Canvas 1".to_string(),
        )));

        let mut canvases = IndexMap::new();
        canvases.insert(default_canvas_id, default_canvas);

        Self {
            room_id,
            canvases,
            tx: Some(tx),
            associated_restore_token: None,
            last_activity_timestamp: Self::current_timestamp(),
        }
    }

    /// 获取当前Unix时间戳（秒）
    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs()
    }

    /// 更新最后活动时间
    pub fn touch(&mut self) {
        self.last_activity_timestamp = Self::current_timestamp();
    }

    /// 检查房间是否空闲超时
    pub fn is_idle(&self) -> bool {
        let now = Self::current_timestamp();
        let idle_duration = now.saturating_sub(self.last_activity_timestamp);
        idle_duration >= IDLE_ROOM_TIMEOUT_SECS
    }

    /// 获取空闲时长（秒）
    pub fn idle_duration(&self) -> u64 {
        let now = Self::current_timestamp();
        now.saturating_sub(self.last_activity_timestamp)
    }

    pub fn ensure_channel(&mut self) {
        if self.tx.is_none() {
            let (tx, _) = broadcast::channel(100);
            self.tx = Some(tx);
        }
        // 恢复后更新活动时间
        self.touch();
    }

    pub fn get_or_create_canvas(
        &mut self,
        canvas_id: Uuid,
        name: String,
    ) -> Arc<RwLock<CanvasState>> {
        self.canvases
            .entry(canvas_id)
            .or_insert_with(|| Arc::new(RwLock::new(CanvasState::new(canvas_id, name))))
            .clone()
    }

    pub fn delete_canvas(&mut self, canvas_id: Uuid) -> bool {
        self.canvases.shift_remove(&canvas_id).is_some()
    }
}

// 全局应用状态（管理所有房间）
#[derive(Debug)]
pub struct AppState {
    pub rooms: RwLock<IndexMap<String, Arc<RwLock<RoomState>>>>,
    pub persistence: crate::persistence::PersistenceManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            rooms: RwLock::new(IndexMap::new()),
            persistence: crate::persistence::PersistenceManager::new(),
        }
    }

    /// 启动空闲房间自动卸载任务
    pub fn start_idle_room_cleanup(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
                IDLE_ROOM_CHECK_INTERVAL_SECS,
            ));

            loop {
                interval.tick().await;

                let idle_rooms = {
                    let rooms = self.rooms.read().unwrap();
                    rooms
                        .iter()
                        .filter_map(|(room_id, room_arc)| {
                            let room = room_arc.read().unwrap();
                            if room.is_idle() {
                                let idle_mins = room.idle_duration() / 60;
                                Some((room_id.clone(), idle_mins))
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                };

                if idle_rooms.is_empty() {
                    continue;
                }

                println!("[Cleanup] Found {} idle rooms", idle_rooms.len());

                for (room_id, idle_mins) in idle_rooms {
                    // 先保存，再卸载
                    println!(
                        "[Cleanup] Room '{}' idle for {} minutes, saving and unloading...",
                        room_id, idle_mins
                    );

                    // 保存房间数据
                    if let Some(room_arc) = self.rooms.read().unwrap().get(&room_id) {
                        let room = room_arc.read().unwrap();
                        if let Err(e) = self.persistence.save_room(&room) {
                            eprintln!("[Cleanup] Failed to save room '{}': {}", room_id, e);
                            continue; // 保存失败就不卸载
                        }
                    }

                    // 从内存中移除
                    self.remove_room(&room_id);
                    println!("[Cleanup] Room '{}' unloaded successfully", room_id);
                }
            }
        });

        println!(
            "[Cleanup] Idle room cleanup task started (timeout: {}h, check interval: {}min)",
            IDLE_ROOM_TIMEOUT_SECS / 3600,
            IDLE_ROOM_CHECK_INTERVAL_SECS / 60
        );
    }

    // 获取或创建房间（不再自动从磁盘加载）
    pub fn get_or_create_room(&self, room_id: &str) -> Arc<RwLock<RoomState>> {
        // 1. Fast Path: 内存里有
        {
            let rooms = self.rooms.read().unwrap();
            if let Some(room) = rooms.get(room_id) {
                return room.clone();
            }
        }

        // 2. Slow Path: 新建
        let mut rooms = self.rooms.write().unwrap();
        // Double check
        if let Some(room) = rooms.get(room_id) {
            return room.clone();
        }

        // 创建新房间（不再自动加载旧数据）
        println!("[AppState] Creating new room '{}'", room_id);
        let room = Arc::new(RwLock::new(RoomState::new(room_id.to_string())));

        rooms.insert(room_id.to_string(), room.clone());
        room
    }

    // 移除房间（用于关闭房间）
    pub fn remove_room(&self, room_id: &str) {
        let mut rooms = self.rooms.write().unwrap();
        rooms.shift_remove(room_id);
        println!("[Memory] Room '{}' unloaded", room_id);
    }

    // 获取所有活跃房间（用于紧急保存）
    pub fn get_all_rooms(&self) -> std::collections::HashMap<String, Arc<RwLock<RoomState>>> {
        let rooms = self.rooms.read().unwrap();
        rooms.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }
}
