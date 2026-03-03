mod commands;
mod export;

use commands::{
    delete_api_key, export_pdf, export_png, list_system_fonts, load_font_data, load_project,
    retrieve_api_key, save_project, show_save_dialog, store_api_key,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            save_project,
            load_project,
            export_pdf,
            export_png,
            store_api_key,
            retrieve_api_key,
            delete_api_key,
            show_save_dialog,
            list_system_fonts,
            load_font_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running viga app");
}

fn main() {
    run();
}
