import type { ServerConfig, ServerMetrics } from "../types";
import { GpuTable } from "./GpuTable";

interface ServerCardProps {
  server: ServerConfig;
  metrics?: ServerMetrics;
  busy: boolean;
  onRefresh: (server: ServerConfig) => void;
  onEdit: (server: ServerConfig) => void;
  onDelete: (server: ServerConfig) => void;
}

export function ServerCard({ server, metrics, busy, onRefresh, onEdit, onDelete }: ServerCardProps) {
  const isOnline = metrics?.online ?? false;
  const gpuMemory = summarizeGpuMemory(metrics);

  return (
    <article className="server-card">
      <header className="server-card-header">
        <div>
          <div className="server-title-row">
            <h2>{server.name}</h2>
            <span className={isOnline ? "status online" : "status offline"}>{isOnline ? "在线" : "未连接"}</span>
          </div>
          <p>
            {server.username}@{server.host}:{server.port} · {server.authType === "privateKey" ? "密钥" : "密码"}
          </p>
        </div>
        <div className="card-actions">
          <button type="button" onClick={() => onRefresh(server)} disabled={busy}>
            {busy ? "刷新中" : "刷新"}
          </button>
          <button type="button" className="ghost" onClick={() => onEdit(server)}>
            编辑
          </button>
          <button type="button" className="danger" onClick={() => onDelete(server)}>
            删除
          </button>
        </div>
      </header>

      {metrics?.error ? <div className="error-box">{metrics.error}</div> : null}

      <div className="metric-grid">
        <div className="metric-tile">
          <span>CPU 利用率</span>
          <strong>{metrics?.cpuUsagePercent != null ? `${metrics.cpuUsagePercent.toFixed(1)}%` : "--"}</strong>
        </div>
        <div className="metric-tile">
          <span>GPU 数量</span>
          <strong>{metrics?.gpus.length ?? 0}</strong>
        </div>
        <div className="metric-tile">
          <span>GPU 显存占用</span>
          <strong>{gpuMemory.label}</strong>
          <small>{gpuMemory.detail}</small>
        </div>
        <div className="metric-tile">
          <span>采集时间</span>
          <strong>{formatCollectedAt(metrics?.collectedAt)}</strong>
        </div>
      </div>

      <GpuTable gpus={metrics?.gpus ?? []} />
    </article>
  );
}

function summarizeGpuMemory(metrics?: ServerMetrics) {
  const gpus = metrics?.gpus ?? [];
  const used = gpus.reduce((sum, gpu) => sum + gpu.memoryUsedMiB, 0);
  const total = gpus.reduce((sum, gpu) => sum + gpu.memoryTotalMiB, 0);
  const percent = total > 0 ? (used / total) * 100 : 0;

  return {
    label: total > 0 ? `${percent.toFixed(1)}%` : "--",
    detail: total > 0 ? `${used} / ${total} MiB` : "等待 GPU 数据",
  };
}

function formatCollectedAt(value?: string) {
  if (!value) {
    return "--";
  }
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "--";
  }
  return new Date(timestamp * 1000).toLocaleTimeString();
}
