#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let context = tauri::generate_context!();
  #[cfg(target_os = "windows")]
  let context = {
    let mut context = context;
    if let Ok(executable) = std::env::current_exe() {
      if let Some(directory) = executable.parent() {
        if directory.join("portable.flag").is_file() {
          context.config_mut().app.app_directories_override = Some(
            tauri::utils::config::AppDirectoriesOverride::Root(directory.join("data")),
          );
        }
      }
    }
    context
  };
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(context)
    .expect("error while building tauri application");
}
