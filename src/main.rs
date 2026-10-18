//! `phygital-key-mcp`: Phygital Key for MCP. AI apps ask through MCP; a person
//! approves the exact action with a passkey, fingerprint or hardware key; the
//! service that acts checks the signed approval itself, offline.
//!
//! Everything but the MCP side comes from the shared base, `phygital-key-gate`.

#![forbid(unsafe_code)]

mod mcp;

use phygital_key_gate::{Adapter, Product, Settings, Shared, Task};
use rmcp::ServiceExt;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};

static PRODUCT: Product = Product {
    name: "Phygital Key MCP",
    bin: "phygital-key-mcp",
    id: "mcp",
    version: env!("CARGO_PKG_VERSION"),
    repo: "Phygital-Key/phygital-key-mcp",
    port: 7468,
    about: "A person approves exact AI actions with a passkey or hardware key. MCP edition.",
    release_keys: include_str!("../release-keys.pem"),
};

struct Mcp;

impl Adapter for Mcp {
    fn path(&self) -> &'static str {
        "/mcp"
    }

    fn router(&self, gate: Shared) -> axum::Router {
        let hosts = vec![
            "localhost".to_string(),
            "127.0.0.1".to_string(),
            "::1".to_string(),
            gate.settings.rp_id.clone(),
        ];
        let service: StreamableHttpService<mcp::GateMcp, LocalSessionManager> =
            StreamableHttpService::new(
                move || Ok(mcp::GateMcp::new(gate.clone())),
                Default::default(),
                // MCP clients are not browsers: refuse any request that carries a browser Origin.
                StreamableHttpServerConfig::default()
                    .with_allowed_hosts(hosts)
                    .enforce_origin_validation(),
            );
        axum::Router::new().nest_service("/mcp", service)
    }

    fn connect_hint(&self, s: &Settings) -> String {
        match &s.access_token {
            Some(t) => format!(
                "  MCP endpoint    {o}/mcp  (needs header  Authorization: Bearer {t})\n  Claude Code:    claude mcp add --transport http phygital-key-mcp {o}/mcp --header \"Authorization: Bearer {t}\"",
                o = s.origin
            ),
            None => format!(
                "  MCP endpoint    {}/mcp  (open: no access token)",
                s.origin
            ),
        }
    }

    fn demo_hint(&self) -> &'static str {
        "Add the MCP endpoint to your AI app, then ask it to deploy `api` 2.4.1 to production through the demo service."
    }

    fn has_stdio(&self) -> bool {
        true
    }

    fn stdio(&self, gate: Shared) -> Option<Task> {
        Some(Box::pin(async move {
            let server = mcp::GateMcp::new(gate)
                .serve(rmcp::transport::stdio())
                .await
                .map_err(|e| format!("mcp: {e}"))?;
            server.waiting().await.map_err(|e| format!("mcp: {e}"))?;
            Ok(())
        }))
    }
}

fn main() {
    phygital_key_gate::run(&PRODUCT, Mcp)
}
