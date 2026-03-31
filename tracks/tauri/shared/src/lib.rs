use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------
// 1. 几何图形定义 (The Shapes)
// ---------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")] // 关键配置：生成 { type: "Line", data: { ... } }
#[serde(rename_all = "camelCase")]       // 关键配置：Rust struct 字段转 camelCase
pub enum ShapeData {
    Line {
        points: Vec<f64>,
        stroke: String,
        stroke_width: f64,
        // 变换属性（用于 Select & Transform 功能）
        #[serde(skip_serializing_if = "Option::is_none")]
        x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        y: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rotation: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleX")]
        scale_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleY")]
        scale_y: Option<f64>,
    },
    Rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        fill: Option<String>,
        stroke: String,
        // 变换属性（用于 Select & Transform 功能）
        #[serde(skip_serializing_if = "Option::is_none")]
        rotation: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleX")]
        scale_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleY")]
        scale_y: Option<f64>,
    },
    // Phase 6: 图片类型
    Image {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        src: String, // Base64 编码的图片数据 "data:image/png;base64,..."
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "srcResourceId")]
        src_resource_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rotation: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleX")]
        scale_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleY")]
        scale_y: Option<f64>,
    },
    // Phase 6: Markdown 文本块
    Markdown {
        x: f64,
        y: f64,
        width: f64,              // 文本框宽度
        height: f64,             // 文本框高度（渲染后确定）
        content: String,         // Markdown 源码
        #[serde(rename = "renderedImage")]
        rendered_image: String,  // 渲染后的 SVG/PNG (Base64)
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "renderedImageResourceId")]
        rendered_image_resource_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        rotation: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleX")]
        scale_x: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "scaleY")]
        scale_y: Option<f64>,
    },
}

// ---------------------------------------------------------
// 2. 动作定义 (The Actions)
// ---------------------------------------------------------

// 批量更新中的单项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItem {
    pub id: Uuid,
    #[serde(rename = "oldShape")]
    pub old_shape: ShapeData,
    #[serde(rename = "newShape")]
    pub new_shape: ShapeData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")] 
#[serde(rename_all = "camelCase")]
pub enum Action {
    Draw {
        // ID 放在 Action 层级，而不是 Shape 层级，
        // 这样 Undo 时只需要由 Action 里的 ID 去索引，不需要解包 Shape
        id: Uuid, 
        shape: ShapeData,
    },
    Erase {
        // 擦除动作：存储被删除的图形 ID 列表
        #[serde(rename = "shapeIds")]
        shape_ids: Vec<Uuid>,
        // 选择工具删除会设置此标志，允许删除图片/Markdown
        #[serde(default)]
        #[serde(rename = "forceAllTypes")]
        force_all_types: bool,
    },
    Update {
        // 更新动作：存储旧状态和新状态，支持 Undo/Redo
        id: Uuid,
        #[serde(rename = "oldShape")]
        old_shape: ShapeData,
        #[serde(rename = "newShape")]
        new_shape: ShapeData,
    },
    BatchUpdate {
        // 批量更新：一次更新多个图形（用于多选拖拽）
        updates: Vec<UpdateItem>,
    },
    Reorder {
        // 显式图形顺序：用于持久化层级语义（例如 BringToFront/SendToBack）
        // 约定：客户端尽量发送当前层完整顺序，服务端会过滤无效/重复 ID
        #[serde(rename = "orderedIds")]
        ordered_ids: Vec<Uuid>,
    },
    Undo,
    Redo,
    Clear,
}

// ---------------------------------------------------------
// 2.5 Canvas 控制命令 (Canvas Management)
// ---------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "camelCase")]
pub enum CanvasCommand {
    Create { id: Uuid, name: String },
    Delete { id: Uuid },
    Rename { id: Uuid, name: String },
    Switch { id: Uuid }, // 切换当前 Canvas
}

// ---------------------------------------------------------
// 2.6 图层控制命令 (Layer Management)
// ---------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "camelCase")]
pub enum LayerCommand {
    Create { 
        #[serde(rename = "canvasId")]
        canvas_id: Uuid, 
        #[serde(rename = "layerId")]
        layer_id: Uuid, 
        name: String 
    },
    Delete { 
        #[serde(rename = "canvasId")]
        canvas_id: Uuid, 
        #[serde(rename = "layerId")]
        layer_id: Uuid 
    },
    Rename { 
        #[serde(rename = "canvasId")]
        canvas_id: Uuid, 
        #[serde(rename = "layerId")]
        layer_id: Uuid,
        name: String
    },
}

// ---------------------------------------------------------
// 3. 客户端消息 (Client -> Server)
// ---------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "camelCase")]
pub enum ClientMessage {
    Join,
    // Canvas 操作
    CanvasCtrl(CanvasCommand),
    // Layer 操作（现在需要指定 canvas_id 和 layer_id）
    LayerOp {
        #[serde(rename = "canvasId")]
        canvas_id: Uuid,
        #[serde(rename = "layerId")]
        layer_id: Uuid,
        action: Action,
    },
    LayerCtrl(LayerCommand),
    // 保存房间到磁盘
    SaveRoom {
        #[serde(rename = "forceNewVersion")]
        force_new_version: bool, // true=强制创建新版本，false=智能覆盖
    },
    // 恢复房间（使用token恢复到新房间ID）
    RestoreRoom {
        #[serde(rename = "restoreToken")]
        restore_token: String,
        #[serde(rename = "newRoomId")]
        new_room_id: String,
    },
    // 关闭房间
    CloseRoom {
        #[serde(rename = "saveBeforeClose")]
        save_before_close: bool, // true=保存并关闭，false=直接关闭
    },
}

// ---------------------------------------------------------
// 4. 服务端广播 (Server -> Client)
// ---------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "camelCase")]
pub enum ServerMessage {
    // Join 时返回全量状态（三级结构）
    SyncState {
        #[serde(rename = "roomId")]
        room_id: String, // 原始 8 位房间号
        canvases: std::collections::HashMap<Uuid, CanvasView>,
        #[serde(rename = "canvasIds")]
        canvas_ids: Vec<Uuid>, // 保证顺序
        #[serde(rename = "restoreToken")]
        #[serde(skip_serializing_if = "Option::is_none")]
        restore_token: Option<String>, // 房间关联的token（如果已保存）
    },
    // 广播增量更新
    BroadCast {
        #[serde(rename = "canvasId")]
        canvas_id: Uuid,
        #[serde(rename = "layerId")]
        layer_id: Uuid,
        action: Action,
    },
    // Canvas 列表变动通知
    CanvasUpdate {
        command: CanvasCommand,
    },
    // 图层列表变动通知
    LayerUpdate {
        command: LayerCommand,
    },
    // 房间已保存（响应 SaveRoom）
    RoomSaved {
        #[serde(rename = "restoreToken")]
        restore_token: String,
        #[serde(rename = "savedAt")]
        saved_at: String,
        #[serde(rename = "saveCount")]
        save_count: usize,
        #[serde(rename = "isUpdate")]
        is_update: bool,
        message: String,
    },
    // 房间已关闭（广播给所有用户）
    RoomClosed {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "closedBy")]
        closed_by: String, // 关闭者的连接ID
        message: String,
    },
    // 错误消息
    Error {
        message: String,
    },
}

// 用于 SyncState 的 Canvas 视图
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasView {
    pub id: Uuid,
    pub name: String,
    pub layers: std::collections::HashMap<Uuid, LayerView>,
    #[serde(rename = "layerIds")]
    pub layer_ids: Vec<Uuid>, // 保证顺序
}

// 用于 SyncState 的 Layer 视图
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerView {
    pub id: Uuid,
    pub name: String,
    pub pointer: usize,
    pub history: Vec<Action>,
}
