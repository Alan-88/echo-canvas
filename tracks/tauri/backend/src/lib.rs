use axum::{
    routing::{get, post},
    Router,
};
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;

pub mod admin;
pub mod handler;
pub mod layer_action_normalizer;
pub mod layer_persistence_compaction;
pub mod layer_snapshot_replay;
pub mod ocr;
pub mod persistence;
pub mod persistence_snapshot_builder;
#[cfg(test)]
pub mod persistence_tests;
pub mod room_command_handlers;
pub mod room_lifecycle;
pub mod room_snapshot;
pub mod resource_inventory;
pub mod resource_snapshot;
pub mod shape_policy;
pub mod shape_resource_refs;
pub mod snapshot_http;
pub mod snapshot_codec;
pub mod state;
pub mod ws_message_codec;

type BackendResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

#[derive(Debug, Clone)]
pub enum ServerMode {
    MultiRoom,
    SinglePlayer { room_id: String },
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub app_host: String,
    pub app_port: u16,
    pub data_root: PathBuf,
    pub mode: ServerMode,
}

impl ServerConfig {
    pub fn from_env() -> Self {
        let app_host = env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let app_port = env::var("APP_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(3000);
        let data_root = env::var("APP_DATA_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./data"));
        let mode = env::var("SINGLE_PLAYER_ROOM_ID")
            .ok()
            .map(|room_id| ServerMode::SinglePlayer { room_id })
            .unwrap_or(ServerMode::MultiRoom);

        Self {
            app_host,
            app_port,
            data_root,
            mode,
        }
    }

    pub fn single_player(data_root: PathBuf, room_id: impl Into<String>) -> Self {
        Self {
            app_host: "127.0.0.1".to_string(),
            app_port: 3000,
            data_root,
            mode: ServerMode::SinglePlayer {
                room_id: room_id.into(),
            },
        }
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.app_host, self.app_port)
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};

        if let Ok(mut stream) = signal(SignalKind::terminate()) {
            let _ = stream.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}

pub fn build_app(app_state: Arc<state::AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/ws/:room_id", get(handler::ws_handler))
        .route("/health", get(|| async { "OK" }))
        .route("/api/server/info", get(snapshot_http::server_info_handler))
        .route(
            "/api/room/:room_id/exists",
            get(snapshot_http::check_room_exists_handler),
        )
        .route("/api/room/restore", post(snapshot_http::restore_room_handler))
        .route(
            "/api/room/validate-snapshot",
            post(snapshot_http::validate_snapshot_handler),
        )
        .route(
            "/api/room/import-snapshot",
            post(snapshot_http::import_snapshot_handler),
        )
        .route(
            "/api/local/load-snapshot",
            post(snapshot_http::load_single_player_snapshot_handler),
        )
        .route("/api/ocr/latex", post(ocr::recognize_latex_handler))
        .route("/api/admin/rooms", get(admin::list_saved_rooms))
        .route("/api/admin/stats", get(admin::server_stats))
        .route("/api/admin/active-rooms", get(admin::list_active_rooms))
        .route(
            "/api/admin/emergency-rooms",
            get(admin::list_emergency_rooms),
        )
        .route("/api/admin/backups", get(admin::list_backups))
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
        .with_state(app_state)
}

pub async fn run_from_env() -> BackendResult<()> {
    run(ServerConfig::from_env()).await
}

pub async fn run(config: ServerConfig) -> BackendResult<()> {
    let single_player_room_id = match &config.mode {
        ServerMode::MultiRoom => None,
        ServerMode::SinglePlayer { room_id } => Some(room_id.clone()),
    };

    let app_state = Arc::new(state::AppState::new(
        persistence::PersistenceManager::new_with_root(config.data_root.clone()),
        single_player_room_id.clone(),
    ));

    if single_player_room_id.is_none() {
        app_state.clone().start_idle_room_cleanup();
    }

    let bind_addr = config.bind_addr();
    let app = build_app(app_state.clone());
    let listener = TcpListener::bind(&bind_addr).await?;

    println!("🏛️ Whiteboard backend running on {}", bind_addr);
    println!("   Data root: {}", config.data_root.display());
    match &config.mode {
        ServerMode::MultiRoom => println!("   Mode: multi-room"),
        ServerMode::SinglePlayer { room_id } => {
            println!("   Mode: single-player ({})", room_id);
        }
    }

    let shutdown_state = app_state.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown_signal().await;
            let rooms = shutdown_state.get_all_rooms();
            shutdown_state.persistence.emergency_save_all(&rooms);
        })
        .await?;

    Ok(())
}
