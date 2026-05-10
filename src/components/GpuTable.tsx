import type { GpuMetrics } from "../types";

interface GpuTableProps {
  gpus: GpuMetrics[];
}

export function GpuTable({ gpus }: GpuTableProps) {
  if (gpus.length === 0) {
    return <div className="empty-gpu">未检测到 NVIDIA GPU 或 nvidia-smi 不可用。</div>;
  }

  return (
    <table className="gpu-table">
      <thead>
        <tr>
          <th>GPU</th>
          <th>显存占用</th>
          <th>Volatile GPU-Util</th>
          <th>进程数</th>
        </tr>
      </thead>
      <tbody>
        {gpus.map((gpu) => {
          const memoryPercent = gpu.memoryTotalMiB > 0 ? (gpu.memoryUsedMiB / gpu.memoryTotalMiB) * 100 : 0;
          return (
            <tr key={gpu.index}>
              <td>
                <strong>#{gpu.index}</strong>
                <span>{gpu.name}</span>
              </td>
              <td>
                <div className="memory-cell-header">
                  <strong>{memoryPercent.toFixed(1)}%</strong>
                  <span>
                    {gpu.memoryUsedMiB} / {gpu.memoryTotalMiB} MiB
                  </span>
                </div>
                <div className="meter memory-meter">
                  <div style={{ width: `${Math.min(memoryPercent, 100)}%` }} />
                </div>
              </td>
              <td>
                <div className="util-value">{gpu.gpuUtilPercent}%</div>
              </td>
              <td>{gpu.processCount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
