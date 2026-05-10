mod config_store;
mod metrics;
mod models;
mod ssh;

use models::{ConnectionRequest, ServerConfig, ServerMetrics};
use ssh::SshManager;
use tauri::State;

#[tauri::command]
fn list_servers() -> Result<Vec<ServerConfig>, String> {
    config_store::list_servers().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_server(server: ServerConfig) -> Result<Vec<ServerConfig>, String> {
    config_store::save_server(server).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_server(id: String) -> Result<Vec<ServerConfig>, String> {
    config_store::delete_server(id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn connect_server(manager: State<'_, SshManager>, request: ConnectionRequest) -> Result<(), String> {
    manager
        .connect_server(request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn disconnect_server(manager: State<'_, SshManager>, server_id: String) -> Result<(), String> {
    manager
        .disconnect_server(server_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn test_connection(manager: State<'_, SshManager>, request: ConnectionRequest) -> Result<(), String> {
    manager
        .test_connection(request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn fetch_metrics(manager: State<'_, SshManager>, request: ConnectionRequest) -> Result<ServerMetrics, String> {
    Ok(metrics::fetch_metrics(&manager, request).await)
}

pub fn run() {
    tauri::Builder::default()
        .manage(SshManager::default())
        .invoke_handler(tauri::generate_handler![
            list_servers,
            save_server,
            delete_server,
            connect_server,
            disconnect_server,
            test_connection,
            fetch_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
