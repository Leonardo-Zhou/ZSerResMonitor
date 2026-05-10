use std::{
    collections::HashMap,
    io::Read,
    net::{TcpStream, ToSocketAddrs},
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use ssh2::Session;
use tokio::time::timeout;

use crate::models::{AuthType, ConnectionRequest, ServerConfig};

const SSH_TIMEOUT: Duration = Duration::from_secs(12);

type SessionMap = Arc<Mutex<HashMap<String, ManagedSession>>>;

#[derive(Clone, Default)]
pub struct SshManager {
    sessions: SessionMap,
}

struct ManagedSession {
    session: Session,
}

impl SshManager {
    pub async fn connect_server(&self, request: ConnectionRequest) -> Result<()> {
        let server_id = request.server.id.clone();
        let session = create_session(request.server, request.password).await?;
        let mut sessions = self.sessions.lock().map_err(|_| anyhow!("SSH 会话池锁定失败"))?;
        sessions.insert(server_id, ManagedSession { session });
        Ok(())
    }

    pub fn disconnect_server(&self, server_id: String) -> Result<()> {
        let mut sessions = self.sessions.lock().map_err(|_| anyhow!("SSH 会话池锁定失败"))?;
        sessions.remove(&server_id);
        Ok(())
    }

    pub async fn test_connection(&self, request: ConnectionRequest) -> Result<()> {
        let server_id = request.server.id.clone();
        self.connect_server(request).await?;
        let output = self.run_remote_command(&server_id, "echo connected").await?;
        if output.trim() == "connected" {
            Ok(())
        } else {
            Err(anyhow!("服务器返回异常: {}", output.trim()))
        }
    }

    pub async fn run_or_connect(&self, request: ConnectionRequest, command: &str) -> Result<String> {
        let server_id = request.server.id.clone();
        if !self.has_session(&server_id)? {
            self.connect_server(request).await?;
        }
        self.run_remote_command(&server_id, command).await
    }

    async fn run_remote_command(&self, server_id: &str, command: &str) -> Result<String> {
        let sessions = Arc::clone(&self.sessions);
        let server_id = server_id.to_string();
        let command = command.to_string();

        timeout(
            SSH_TIMEOUT,
            tokio::task::spawn_blocking(move || {
                let mut sessions = sessions.lock().map_err(|_| anyhow!("SSH 会话池锁定失败"))?;
                let managed = sessions
                    .get_mut(&server_id)
                    .ok_or_else(|| anyhow!("服务器尚未连接"))?;
                run_remote_command_blocking(&mut managed.session, &command)
            }),
        )
        .await
        .context("SSH 命令超时")?
        .context("SSH 任务执行失败")?
    }

    fn has_session(&self, server_id: &str) -> Result<bool> {
        let sessions = self.sessions.lock().map_err(|_| anyhow!("SSH 会话池锁定失败"))?;
        Ok(sessions.contains_key(server_id))
    }
}

async fn create_session(server: ServerConfig, password: Option<String>) -> Result<Session> {
    timeout(
        SSH_TIMEOUT,
        tokio::task::spawn_blocking(move || create_session_blocking(&server, password.as_deref())),
    )
    .await
    .context("SSH 连接超时")?
    .context("SSH 连接任务失败")?
}

fn create_session_blocking(server: &ServerConfig, password: Option<&str>) -> Result<Session> {
    let address = (server.host.as_str(), server.port)
        .to_socket_addrs()
        .context("解析服务器地址失败")?
        .next()
        .ok_or_else(|| anyhow!("服务器地址不可用"))?;

    let tcp = TcpStream::connect_timeout(&address, Duration::from_secs(8)).context("连接服务器失败")?;
    tcp.set_read_timeout(Some(Duration::from_secs(8)))?;
    tcp.set_write_timeout(Some(Duration::from_secs(8)))?;

    let mut session = Session::new().context("创建 SSH 会话失败")?;
    session.set_tcp_stream(tcp);
    session.handshake().context("SSH 握手失败")?;
    authenticate(server, password, &session)?;
    Ok(session)
}

fn run_remote_command_blocking(session: &mut Session, command: &str) -> Result<String> {
    if !session.authenticated() {
        return Err(anyhow!("SSH 会话已断开，请重新连接"));
    }

    let mut channel = session.channel_session().context("创建 SSH 通道失败")?;
    channel.exec(command).context("执行远程命令失败")?;

    let mut stdout = String::new();
    channel.read_to_string(&mut stdout).context("读取远程命令输出失败")?;

    let mut stderr = String::new();
    channel.stderr().read_to_string(&mut stderr).ok();

    channel.wait_close().context("关闭 SSH 通道失败")?;
    let exit_status = channel.exit_status().context("读取远程命令状态失败")?;
    if exit_status == 0 {
        Ok(stdout)
    } else {
        Err(anyhow!(if stderr.trim().is_empty() {
            format!("远程命令执行失败，退出码 {}", exit_status)
        } else {
            stderr.trim().to_string()
        }))
    }
}

fn authenticate(server: &ServerConfig, password: Option<&str>, session: &Session) -> Result<()> {
    match server.auth_type {
        AuthType::Password => {
            let password = password
                .filter(|value| !value.is_empty())
                .ok_or_else(|| anyhow!("密码登录需要输入本次连接密码"))?;
            session
                .userauth_password(&server.username, password)
                .context("SSH 密码认证失败")?;
        }
        AuthType::PrivateKey => {
            let path = server
                .private_key_path
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| anyhow!("密钥登录需要提供私钥路径"))?;
            session
                .userauth_pubkey_file(&server.username, None, Path::new(path), password)
                .context("SSH 密钥认证失败")?;
        }
    }

    if session.authenticated() {
        Ok(())
    } else {
        Err(anyhow!("SSH 认证未通过"))
    }
}
