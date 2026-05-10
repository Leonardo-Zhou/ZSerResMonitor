use crate::{
    models::{ConnectionRequest, GpuMetrics, ServerMetrics},
    ssh::SshManager,
};

const METRICS_SCRIPT: &str = r#"
set -u
cpu_line_1=$(grep '^cpu ' /proc/stat 2>/dev/null || true)
sleep 0.4
cpu_line_2=$(grep '^cpu ' /proc/stat 2>/dev/null || true)
python3 - <<'PY' "$cpu_line_1" "$cpu_line_2"
import sys

def usage(line1, line2):
    if not line1 or not line2:
        return None
    a = [int(x) for x in line1.split()[1:]]
    b = [int(x) for x in line2.split()[1:]]
    idle_a = a[3] + (a[4] if len(a) > 4 else 0)
    idle_b = b[3] + (b[4] if len(b) > 4 else 0)
    total_a = sum(a)
    total_b = sum(b)
    total_delta = total_b - total_a
    idle_delta = idle_b - idle_a
    if total_delta <= 0:
        return None
    return round((1 - idle_delta / total_delta) * 100, 1)

value = usage(sys.argv[1], sys.argv[2])
print(f"CPU={value if value is not None else ''}")
PY
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "GPU_START"
  nvidia-smi --query-gpu=index,uuid,name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits 2>/dev/null || true
  echo "GPU_PROCESS_START"
  nvidia-smi --query-compute-apps=gpu_uuid,pid --format=csv,noheader,nounits 2>/dev/null || true
else
  echo "GPU_START"
  echo "GPU_PROCESS_START"
fi
"#;

pub async fn fetch_metrics(manager: &SshManager, request: ConnectionRequest) -> ServerMetrics {
    let server_id = request.server.id.clone();
    match manager.run_or_connect(request, METRICS_SCRIPT).await {
        Ok(output) => parse_metrics(&server_id, &output),
        Err(error) => ServerMetrics {
            server_id,
            online: false,
            collected_at: collected_at(),
            cpu_usage_percent: None,
            gpus: Vec::new(),
            error: Some(error.to_string()),
        },
    }
}

fn parse_metrics(server_id: &str, output: &str) -> ServerMetrics {
    let mut cpu_usage_percent = None;
    let mut gpu_lines = Vec::new();
    let mut process_lines = Vec::new();
    let mut section = "root";

    for line in output.lines().map(str::trim).filter(|line| !line.is_empty()) {
        match line {
            "GPU_START" => section = "gpu",
            "GPU_PROCESS_START" => section = "process",
            _ if line.starts_with("CPU=") => {
                let value = line.trim_start_matches("CPU=");
                cpu_usage_percent = parse_optional_f64(value);
            }
            _ if section == "gpu" => gpu_lines.push(line.to_string()),
            _ if section == "process" => process_lines.push(line.to_string()),
            _ => {}
        }
    }

    ServerMetrics {
        server_id: server_id.to_string(),
        online: true,
        collected_at: collected_at(),
        cpu_usage_percent,
        gpus: parse_gpus(&gpu_lines, &process_lines),
        error: None,
    }
}

fn parse_gpus(gpu_lines: &[String], process_lines: &[String]) -> Vec<GpuMetrics> {
    let mut process_counts = std::collections::HashMap::<String, u32>::new();
    for line in process_lines {
        let parts: Vec<_> = line.split(',').map(|part| part.trim()).collect();
        if let Some(uuid) = parts.first().filter(|uuid| !uuid.is_empty()) {
            *process_counts.entry((*uuid).to_string()).or_insert(0) += 1;
        }
    }

    gpu_lines
        .iter()
        .filter_map(|line| {
            let parts: Vec<_> = line.split(',').map(|part| part.trim()).collect();
            if parts.len() < 6 {
                return None;
            }

            let uuid = parts[1].to_string();
            Some(GpuMetrics {
                index: parse_optional_u32(parts[0]),
                name: parts[2].to_string(),
                memory_used_mib: parse_optional_u64(parts[3]),
                memory_total_mib: parse_optional_u64(parts[4]),
                gpu_util_percent: parse_optional_u32(parts[5]),
                process_count: process_counts.get(&uuid).copied().unwrap_or(0),
            })
        })
        .collect()
}

fn parse_optional_f64(value: &str) -> Option<f64> {
    let value = value.trim();
    if value.is_empty() || value == "N/A" || value == "[Not Supported]" {
        None
    } else {
        value.parse().ok()
    }
}

fn parse_optional_u32(value: &str) -> u32 {
    parse_optional_u64(value).min(u32::MAX as u64) as u32
}

fn parse_optional_u64(value: &str) -> u64 {
    let value = value.trim();
    if value.is_empty() || value == "N/A" || value == "[Not Supported]" {
        0
    } else {
        value.parse().unwrap_or(0)
    }
}

fn collected_at() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
