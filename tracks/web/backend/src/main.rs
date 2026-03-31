use axum::{
    routing::{get, post},
    Router,
};
use std::env;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;

mod admin;
mod handler;
mod layer_action_normalizer;
mod layer_persistence_compaction;
mod layer_snapshot_replay;
mod ocr;
mod persistence;
mod persistence_snapshot_builder;
#[cfg(test)]
mod persistence_tests;
mod room_http;
mod resource_inventory;
mod resource_snapshot;
mod shape_policy;
mod shape_resource_refs;
mod snapshot_codec;
mod snapshot_import_validation;
mod state;
mod ws_room_commands;
mod ws_sync_state;
mod ws_message_codec;

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

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    let app_host = env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let app_port = env::var("APP_PORT").unwrap_or_else(|_| "3000".to_string());
    let bind_addr = format!("{app_host}:{app_port}");

    // 1. 初始化共享状态
    let app_state = Arc::new(state::AppState::new());

    // 2. 启动空闲房间自动卸载任务
    app_state.clone().start_idle_room_cleanup();

    // 3. 配置CORS（允许所有来源）
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 4. 构建路由（支持房间 ID + 管理API）
    let app = Router::new()
        .route("/ws/:room_id", get(handler::ws_handler))
        .route("/health", get(|| async { "OK" }))
        .route("/api/server/info", get(room_http::server_info_handler))
        .route(
            "/api/room/:room_id/exists",
            get(room_http::check_room_exists_handler),
        )
        .route("/api/room/restore", post(room_http::restore_room_handler))
        .route(
            "/api/room/validate-snapshot",
            post(room_http::validate_snapshot_handler),
        )
        .route(
            "/api/room/import-snapshot",
            post(room_http::import_snapshot_handler),
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
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10MB payload limit
        .with_state(app_state.clone());

    // 5. 启动主服务器
    let listener = TcpListener::bind(&bind_addr).await.unwrap();
    println!("🏛️ Whiteboard Server v3.4 (Secure Import System) running on:");
    println!("   Bind Addr: {}", bind_addr);
    println!("   WebSocket: ws://{}/ws/:room_id", bind_addr);
    println!("   HTTP API:  http://{}/api/room/restore", bind_addr);
    println!("   OCR API:   http://{}/api/ocr/latex", bind_addr);
    println!("   Admin API: http://{}/api/admin/* (仅通过独立客户端访问)", bind_addr);
    println!("   💾 Emergency save: Enabled (Ctrl+C to trigger)");
    println!("   🧹 Idle cleanup: Enabled (2h timeout, 5min check)");
    println!("   🛡️ Payload limit: 10MB (secure import protection)");

    let shutdown_state = app_state.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown_signal().await;
            println!("\n⚠️  Received shutdown signal");
            println!("🚨 Performing emergency save of all active rooms...");

            let rooms = shutdown_state.get_all_rooms();
            shutdown_state.persistence.emergency_save_all(&rooms);

            println!("✅ Emergency save completed. Shutting down gracefully.");
        })
        .await
        .unwrap();
}
