import type { GpuMetrics, ServerConfig, ServerMetrics } from "../types";

interface CompactServerCardProps {
  server: ServerConfig;
  metrics?: ServerMetrics;
  busy: boolean;
  onRefresh: (server: ServerConfig) => void;
  onEdit: (server: ServerConfig) => void;
}

export function CompactServerCard({ server, metrics, busy, onRefresh, onEdit }: CompactServerCardProps) {
  const gpus = metrics?.gpus ?? [];
  const statusClass = metrics?.online ? "online" : "offline";
  const cpu = metrics?.cpuUsagePercent ?? 0;

  return (
    <article className={`compact-card ${statusClass}`}>
      <header className="compact-card-head">
        <div>
          <div className="compact-name-row">
            <span className="status-dot" />
            <strong>{server.name}</strong>
          </div>
          <small>{server.host}</small>
        </div>
        <div className="compact-actions">
          <button type="button" onClick={() => onRefresh(server)} disabled={busy} aria-label="刷新服务器">
            {busy ? "…" : "↻"}
          </button>
          <button type="button" onClick={() => onEdit(server)} aria-label="编辑服务器">
            ✎
          </button>
        </div>
      </header>

      <div className="compact-signal-row">
        <MetricPill label="CPU" value={cpu} tone={toneFor(cpu)} />
        <MetricPill label="GPU" value={peakGpuUtil(gpus)} tone={toneFor(peakGpuUtil(gpus))} />
        <MetricPill label="MEM" value={gpuMemoryPercent(gpus)} tone={toneFor(gpuMemoryPercent(gpus))} />
      </div>

      <div className="compact-bars">
        {gpus.length === 0 ? (
          <div className="compact-empty-gpu">NO GPU SIGNAL</div>
        ) : (
          gpus.map((gpu) => <CompactGpuBar key={gpu.index} gpu={gpu} />)
        )}
      </div>
    </article>
  );
}

function CompactGpuBar({ gpu }: { gpu: GpuMetrics }) {
  const memory = gpu.memoryTotalMiB > 0 ? (gpu.memoryUsedMiB / gpu.memoryTotalMiB) * 100 : 0;
  const util = gpu.gpuUtilPercent;

  return (
    <div className="compact-gpu-row">
      <div className="compact-gpu-label">
        <span>#{gpu.index}</span>
        <b>{gpu.processCount}</b>
      </div>
      <div className="compact-gpu-bars">
        <div className="compact-bar memory" title={`显存 ${memory.toFixed(1)}%`}>
          <i style={{ width: `${Math.min(memory, 100)}%` }} />
        </div>
        <div className="compact-bar util" title={`GPU ${util}%`}>
          <i style={{ width: `${Math.min(util, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`metric-pill ${tone}`}>
      <span>{label}</span>
      <strong>{Number.isFinite(value) ? Math.round(value) : 0}</strong>
    </div>
  );
}

function peakGpuUtil(gpus: GpuMetrics[]) {
  return gpus.reduce((peak, gpu) => Math.max(peak, gpu.gpuUtilPercent), 0);
}

function gpuMemoryPercent(gpus: GpuMetrics[]) {
  const used = gpus.reduce((sum, gpu) => sum + gpu.memoryUsedMiB, 0);
  const total = gpus.reduce((sum, gpu) => sum + gpu.memoryTotalMiB, 0);
  return total > 0 ? (used / total) * 100 : 0;
}

function toneFor(value: number) {
  if (value >= 85) {
    return "hot";
  }
  if (value >= 55) {
    return "warm";
  }
  return "cool";
}
