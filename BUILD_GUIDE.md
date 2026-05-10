# ZSerResMonitor 构建指南

## 环境要求

- Node.js 18+
- Rust 1.70+
- npm 或 yarn

## 安装依赖

```bash
npm install
```

## 开发模式

```bash
npm run tauri dev
```

## 构建发布版本

### macOS

```bash
npm run tauri build -- --target aarch64-apple-darwin
# 或
npm run tauri build -- --target x86_64-apple-darwin
```

产物：`src-tauri/target/release/bundle/dmg/ZSerResMonitor_x.x.x_aarch64.dmg`

### Windows

```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

产物：`src-tauri/target/release/bundle/msi/ZSerResMonitor_x.x.x_x64_en-US.msi`

### Linux

```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

产物：`src-tauri/target/release/bundle/deb/ZSerResMonitor_x.x.x_amd64.deb`

## 构建所有平台

```bash
npm run tauri build
```

## 产物位置

构建产物位于 `src-tauri/target/release/bundle/` 目录下：
- `dmg/` - macOS 安装包
- `msi/` - Windows 安装包
- `deb/` - Linux Debian 包
