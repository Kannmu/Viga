use std::fs;

use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::export::pdf::PdfExporter;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePayload {
    pub path: String,
    pub document: String,
    pub assets: Vec<u8>,
    pub thumbnail: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FontInfo {
    pub family: String,
    pub style: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
pub async fn save_project(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_project(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_pdf(document_json: String, output_path: String) -> Result<(), String> {
    let exporter = PdfExporter::new();
    let bytes = exporter.export(&document_json).map_err(|e| e.to_string())?;
    fs::write(output_path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_png(
    canvas_data: Vec<u8>,
    _width: u32,
    _height: u32,
    output_path: String,
    _scale: f32,
) -> Result<(), String> {
    fs::write(output_path, canvas_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn store_api_key(profile_id: String, key: String) -> Result<(), String> {
    let entry = Entry::new("viga", &profile_id).map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retrieve_api_key(profile_id: String) -> Result<String, String> {
    let entry = Entry::new("viga", &profile_id).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_api_key(profile_id: String) -> Result<(), String> {
    let entry = Entry::new("viga", &profile_id).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn show_save_dialog(
    _default_name: String,
    _filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<FontInfo>, String> {
    Ok(vec![FontInfo {
        family: "Segoe UI".to_string(),
        style: "Regular".to_string(),
    }])
}

#[tauri::command]
pub async fn load_font_data(_font_family: String) -> Result<Vec<u8>, String> {
    Ok(Vec::new())
}
