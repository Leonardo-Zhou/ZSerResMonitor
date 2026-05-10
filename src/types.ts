export type AuthType = "password" | "privateKey";

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  privateKeyPath?: string | null;
}

export interface ConnectionRequest {
  server: ServerConfig;
  password?: string;
}

export interface GpuMetrics {
  index: number;
  name: string;
  memoryUsedMiB: number;
  memoryTotalMiB: number;
  gpuUtilPercent: number;
  processCount: number;
}

export interface ServerMetrics {
  serverId: string;
  online: boolean;
  collectedAt: string;
  cpuUsagePercent?: number | null;
  gpus: GpuMetrics[];
  error?: string | null;
}
