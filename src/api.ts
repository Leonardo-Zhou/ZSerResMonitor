import { invoke } from "@tauri-apps/api/core";
import type { ConnectionRequest, ServerConfig, ServerMetrics } from "./types";

export function listServers() {
  return invoke<ServerConfig[]>("list_servers");
}

export function saveServer(server: ServerConfig) {
  return invoke<ServerConfig[]>("save_server", { server });
}

export function deleteServer(id: string) {
  return invoke<ServerConfig[]>("delete_server", { id });
}

export function connectServer(request: ConnectionRequest) {
  return invoke<void>("connect_server", { request });
}

export function disconnectServer(serverId: string) {
  return invoke<void>("disconnect_server", { serverId });
}

export function testConnection(request: ConnectionRequest) {
  return invoke<void>("test_connection", { request });
}

export function fetchMetrics(request: ConnectionRequest) {
  return invoke<ServerMetrics>("fetch_metrics", { request });
}
