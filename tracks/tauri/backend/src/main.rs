#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    if let Err(error) = whiteboard_backend::run_from_env().await {
        eprintln!("backend exited with error: {}", error);
        std::process::exit(1);
    }
}
