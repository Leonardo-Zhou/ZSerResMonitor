use std::{fs, path::PathBuf};

use anyhow::{Context, Result};

use crate::models::ServerConfig;

fn config_path() -> Result<PathBuf> {
    let base = dirs::config_dir().context("无法定位系统配置目录")?;
    Ok(base.join("z-server-resource-monitor").join("servers.json"))
}

pub fn list_servers() -> Result<Vec<ServerConfig>> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .with_context(|| format!("读取服务器配置失败: {}", path.display()))?;
    let servers = serde_json::from_str(&content).context("解析服务器配置失败")?;
    Ok(servers)
}

pub fn save_server(server: ServerConfig) -> Result<Vec<ServerConfig>> {
    let mut servers = list_servers()?;

    if let Some(existing) = servers.iter_mut().find(|item| item.id == server.id) {
        *existing = server;
    } else {
        servers.push(server);
    }

    write_servers(&servers)?;
    Ok(servers)
}

pub fn delete_server(id: String) -> Result<Vec<ServerConfig>> {
    let mut servers = list_servers()?;
    servers.retain(|server| server.id != id);
    write_servers(&servers)?;
    Ok(servers)
}

fn write_servers(servers: &[ServerConfig]) -> Result<()> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建配置目录失败: {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(servers).context("序列化服务器配置失败")?;
    fs::write(&path, content).with_context(|| format!("写入服务器配置失败: {}", path.display()))?;
    Ok(())
}
