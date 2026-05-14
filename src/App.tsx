import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectServer, deleteServer, disconnectServer, fetchMetrics, listServers, saveServer, testConnection } from "./api";
import { CompactServerCard } from "./components/CompactServerCard";
import { ServerCard } from "./components/ServerCard";
import { ServerForm } from "./components/ServerForm";
import type { ServerConfig, ServerMetrics } from "./types";

export default function App() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ServerMetrics>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyServers, setBusyServers] = useState<Record<string, boolean>>({});
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(3);
  const [viewMode, setViewMode] = useState<"detail" | "compact">("detail");
  const [message, setMessage] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  const hasServers = servers.length > 0;
  const busyCount = useMemo(() => Object.values(busyServers).filter(Boolean).length, [busyServers]);

  useEffect(() => {
    listServers()
      .then(setServers)
      .catch((error) => setMessage(String(error)));
  }, []);

  const refreshServer = useCallback(
    async (server: ServerConfig, options: { quiet?: boolean; reconnect?: boolean } = {}) => {
      if (inFlightRef.current.has(server.id)) {
        return;
      }

      inFlightRef.current.add(server.id);
      setBusy(server.id, true);
      if (!options.quiet) {
        setMessage(null);
      }

      try {
        const request = { server, password: passwords[server.id] };
        if (options.reconnect) {
          await disconnectServer(server.id);
          await connectServer(request);
        }
        const result = await fetchMetrics(request);
        setMetrics((current) => ({ ...current, [server.id]: result }));
      } catch (error) {
        if (!options.quiet) {
          setMessage(String(error));
        }
      } finally {
        inFlightRef.current.delete(server.id);
        setBusy(server.id, false);
      }
    },
    [passwords],
  );

  useEffect(() => {
    if (!autoRefreshEnabled || servers.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      servers.forEach((server) => refreshServer(server, { quiet: true }));
    }, Math.max(refreshIntervalSeconds, 1) * 1000);

    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, refreshIntervalSeconds, refreshServer, servers]);

  async function handleSave(server: ServerConfig, password?: string) {
    setShowForm(false);
    setEditingServer(null);

    try {
      const nextServers = await saveServer(server);
      setServers(nextServers);
      if (password) {
        setPasswords((current) => ({ ...current, [server.id]: password }));
      }
      await connectServer({ server, password });
      setMessage("服务器配置已保存并保持连接，资源数据将自动刷新。");
      await refreshServer(server);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function handleDelete(server: ServerConfig) {
    try {
      await disconnectServer(server.id);
      const nextServers = await deleteServer(server.id);
      setServers(nextServers);
      setMetrics((current) => {
        const next = { ...current };
        delete next[server.id];
        return next;
      });
      setPasswords((current) => {
        const next = { ...current };
        delete next[server.id];
        return next;
      });
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function refreshAll() {
    await Promise.all(servers.map((server) => refreshServer(server, { reconnect: true })));
  }

  async function testSelectedConnection(server: ServerConfig) {
    setBusy(server.id, true);
    try {
      await testConnection({ server, password: passwords[server.id] });
      setMessage(`${server.name} 连接成功，并已保持 SSH 会话。`);
      await refreshServer(server);
    } catch (error) {
      setMessage(`${server.name} 连接失败：${String(error)}`);
    } finally {
      setBusy(server.id, false);
    }
  }

  function setBusy(serverId: string, busy: boolean) {
    setBusyServers((current) => ({ ...current, [serverId]: busy }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="eyebrow">SSH Resource Monitor</span>
          <h1>服务器资源监控</h1>
          <p>通过保持 SSH 会话动态查看 CPU、GPU 显存、GPU Util 与 GPU 进程数量。</p>
        </div>

        <button type="button" className="primary wide" onClick={() => { setEditingServer(null); setShowForm(true); }}>
          添加服务器
        </button>

        <button type="button" className="wide" disabled={!hasServers || busyCount > 0} onClick={refreshAll}>
          {busyCount > 0 ? `刷新中 (${busyCount})` : "立即刷新"}
        </button>

        <div className="refresh-panel">
          <label className="toggle-row">
            <input type="checkbox" checked={autoRefreshEnabled} onChange={(event) => setAutoRefreshEnabled(event.target.checked)} />
            自动刷新
          </label>
          <label>
            间隔秒数
            <input
              type="number"
              min={1}
              max={60}
              value={refreshIntervalSeconds}
              onChange={(event) => setRefreshIntervalSeconds(Number(event.target.value) || 1)}
            />
          </label>
        </div>

        <div className="server-list">
          <h3>服务器列表</h3>
          {servers.length === 0 ? <p className="muted">还没有添加服务器。</p> : null}
          {servers.map((server) => (
            <button key={server.id} type="button" onClick={() => testSelectedConnection(server)}>
              <span>{server.name}</span>
              <small>{server.host}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="content">
        <header className="content-header">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h2>实时资源概览</h2>
          </div>
          <div className="header-actions">
            <div className="view-switch" aria-label="切换显示模式">
              <button type="button" className={viewMode === "detail" ? "active" : ""} onClick={() => setViewMode("detail")}>
                详细
              </button>
              <button type="button" className={viewMode === "compact" ? "active" : ""} onClick={() => setViewMode("compact")}>
                简要
              </button>
            </div>
            {message ? <div className="toast">{message}</div> : null}
          </div>
        </header>

        <div className={viewMode === "compact" ? "compact-cards-grid" : "cards-grid"}>
          {servers.length === 0 ? (
            <div className="empty-state">
              <h2>先添加一台服务器</h2>
              <p>建议优先使用 SSH 私钥登录。添加后软件会保持 SSH 会话并自动刷新资源指标。</p>
              <button type="button" className="primary" onClick={() => setShowForm(true)}>
                添加第一台服务器
              </button>
            </div>
          ) : (
            servers.map((server) =>
              viewMode === "compact" ? (
                <CompactServerCard
                  key={server.id}
                  server={server}
                  metrics={metrics[server.id]}
                  busy={Boolean(busyServers[server.id])}
                  onRefresh={(server) => refreshServer(server, { reconnect: true })}
                  onEdit={(target) => { setEditingServer(target); setShowForm(true); }}
                />
              ) : (
                <ServerCard
                  key={server.id}
                  server={server}
                  metrics={metrics[server.id]}
                  busy={Boolean(busyServers[server.id])}
                  onRefresh={(server) => refreshServer(server, { reconnect: true })}
                  onEdit={(target) => { setEditingServer(target); setShowForm(true); }}
                  onDelete={handleDelete}
                />
              ),
            )
          )}
        </div>
      </section>

      {showForm ? (
        <div className="editor-backdrop" role="presentation" onMouseDown={() => { setShowForm(false); setEditingServer(null); }}>
          <div className="editor-card" role="dialog" aria-modal="true" aria-label={editingServer ? "编辑服务器" : "添加服务器"} onMouseDown={(event) => event.stopPropagation()}>
            <ServerForm server={editingServer} onSubmit={handleSave} onCancel={() => { setShowForm(false); setEditingServer(null); }} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
