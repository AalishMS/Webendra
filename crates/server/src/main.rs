mod render;

use axum::{
    extract::Path,
    http::{header, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use std::path::PathBuf;
use tower::ServiceBuilder;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use webendra_shared::index_from_slug;

async fn home() -> Html<String> {
    Html(render::render_page(0))
}

async fn character_page(Path(slug): Path<String>) -> Response {
    match index_from_slug(&slug) {
        Some(index) => Html(render::render_page(index)).into_response(),
        None => (StatusCode::NOT_FOUND, Html(render::render_not_found())).into_response(),
    }
}

fn static_dir() -> PathBuf {
    // Explicit override always wins.
    if let Ok(dir) = std::env::var("WEBENDRA_STATIC_DIR") {
        return PathBuf::from(dir);
    }

    // `cargo run` builds into `target/{debug,release}/`, two levels below
    // the workspace root where `static/` lives; check next to the running
    // executable first so the built binary is relocatable.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("static");
            if candidate.is_dir() {
                return candidate;
            }
            if let Some(workspace_root) = dir.parent().and_then(|p| p.parent()) {
                let candidate = workspace_root.join("static");
                if candidate.is_dir() {
                    return candidate;
                }
            }
        }
    }

    // Fall back to the workspace root relative to this crate, for
    // `cargo run` invocations from an arbitrary working directory.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .expect("workspace root")
        .join("static")
}

#[tokio::main]
async fn main() {
    let static_root = static_dir();
    let assets_dir = static_root.join("assets");

    let assets_service = ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        ))
        .service(ServeDir::new(&assets_dir));

    let security_headers = ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ));

    let app = Router::new()
        .route("/", get(home))
        .route("/character/{slug}", get(character_page))
        .nest_service("/assets", assets_service)
        .fallback_service(ServeDir::new(&static_root))
        .layer(security_headers);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind port");

    println!("Webendra listening on http://{addr}");
    axum::serve(listener, app).await.expect("server error");
}
