use std::fs;
use std::net::TcpListener;

use tauri::Manager;

mod local_save_commands;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalRuntimeConfig {
    server_address: String,
    api_base_url: String,
    ws_base_url: String,
    frontend_origin: String,
}

fn pick_local_backend_port() -> Result<u16, String> {
    if TcpListener::bind(("127.0.0.1", 3000)).is_ok() {
        return Ok(3000);
    }

    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    drop(listener);
    Ok(port)
}

#[tauri::command]
fn get_local_runtime_config(config: tauri::State<'_, LocalRuntimeConfig>) -> LocalRuntimeConfig {
    config.inner().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_local_runtime_config,
            local_save_commands::list_local_saves,
            local_save_commands::create_local_save,
            local_save_commands::activate_local_save,
            local_save_commands::import_local_save_snapshot
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let data_root = app_handle
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;
            fs::create_dir_all(&data_root).map_err(|error| error.to_string())?;
            let backend_port = pick_local_backend_port()?;
            let server_address = format!("http://127.0.0.1:{backend_port}");
            let runtime_config = LocalRuntimeConfig {
                server_address: server_address.clone(),
                api_base_url: server_address.clone(),
                ws_base_url: server_address.replacen("http", "ws", 1),
                frontend_origin: "tauri://localhost".to_string(),
            };
            app.manage(runtime_config);

            tauri::async_runtime::spawn(async move {
                let config = whiteboard_backend::ServerConfig {
                    app_host: "127.0.0.1".to_string(),
                    app_port: backend_port,
                    data_root,
                    mode: whiteboard_backend::ServerMode::SinglePlayer {
                        room_id: "local-room".to_string(),
                    },
                };
                if let Err(error) = whiteboard_backend::run(config).await {
                    eprintln!("local backend exited with error: {}", error);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
