import { FormEvent, useEffect, useState } from "react";
import type { ServerConfig } from "../types";

interface ServerFormProps {
  server?: ServerConfig | null;
  onSubmit: (server: ServerConfig, password?: string) => void;
  onCancel: () => void;
}

const emptyServer: ServerConfig = {
  id: "",
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "privateKey",
  privateKeyPath: "",
};

export function ServerForm({ server, onSubmit, onCancel }: ServerFormProps) {
  const [form, setForm] = useState<ServerConfig>(emptyServer);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setForm(server ?? { ...emptyServer, id: crypto.randomUUID() });
    setPassword("");
  }, [server]);

  function update<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function stripOuterQuotes(value: string) {
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(
      {
        ...form,
        name: form.name.trim() || form.host.trim(),
        host: form.host.trim(),
        username: form.username.trim(),
        privateKeyPath: form.authType === "privateKey" ? stripOuterQuotes(form.privateKeyPath ?? "") || null : null,
      },
      form.authType === "password" ? password : undefined,
    );
  }

  return (
    <form className="server-form" onSubmit={submit}>
      <div className="form-header">
        <div>
          <h2>{server ? "编辑服务器" : "添加服务器"}</h2>
          <p>密码仅用于本次连接，不会写入本地配置文件。</p>
        </div>
        <button type="button" className="ghost" onClick={onCancel}>
          关闭
        </button>
      </div>

      <label>
        显示名称
        <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="A100 训练服务器" />
      </label>

      <div className="form-row">
        <label>
          主机地址
          <input value={form.host} onChange={(event) => update("host", event.target.value)} required placeholder="192.168.1.20" />
        </label>
        <label>
          端口
          <input
            type="number"
            min={1}
            max={65535}
            value={form.port}
            onChange={(event) => update("port", Number(event.target.value))}
            required
          />
        </label>
      </div>

      <label>
        用户名
        <input value={form.username} onChange={(event) => update("username", event.target.value)} required placeholder="ubuntu" />
      </label>

      <label>
        登录方式
        <select value={form.authType} onChange={(event) => update("authType", event.target.value as ServerConfig["authType"])}>
          <option value="privateKey">私钥路径</option>
          <option value="password">账号密码</option>
        </select>
      </label>

      {form.authType === "privateKey" ? (
        <label>
          私钥路径
          <input
            value={form.privateKeyPath ?? ""}
            onChange={(event) => update("privateKeyPath", event.target.value)}
            placeholder="/Users/you/.ssh/id_rsa 或 C:\\Users\\you\\.ssh\\id_rsa"
          />
        </label>
      ) : (
        <label>
          本次连接密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="不会保存到配置文件" />
        </label>
      )}

      <div className="form-actions">
        <button type="submit">保存服务器</button>
      </div>
    </form>
  );
}
