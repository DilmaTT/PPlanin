#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;

#[tauri::command]
fn get_current_timestamp() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_current_timestamp])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
