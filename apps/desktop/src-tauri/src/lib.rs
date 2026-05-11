// Echoes Desktop — minimal Tauri 2.0 wrapper
// Config: tauri.conf.json
// Dev mode: loads http://localhost:3000 (Next.js dev server)
// Build mode: loads static files from ../../web/out

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Echoes desktop application")
}
