# 🦦 Otter

Otter (ot) 是一个基于 [Mihomo](https://github.com/MetaCubeX/mihomo)
核心的极简主义 Clash TUI
客户端。它专为速度和可组合性而设计，提供流畅的命令行体验和交互式界面。

## ✨ 特性

- **轻量级**: 基于 Bun 和 Ink 构建，启动迅速。
- **Mihomo 核心**: 使用高性能的 Mihomo (Clash Meta) 作为底层核心。
- **交互式 TUI**: 提供美观的终端用户界面，支持键盘导航。
- **订阅管理**: 支持多种订阅格式（Clash YAML, Base64, VMess/SS/Trojan 链接）。
- **系统集成**: 一键开启/关闭 macOS 系统代理，支持 Shell 代理注入。
- **实时监控**: 实时查看流量速度、内存占用和节点状态。

## 📦 安装

### 通过 npm (推荐)

确保你已经安装了 [Bun](https://bun.sh/)。

```bash
bun add -g @meanc/otter
```

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/otter.git
cd otter

# 安装依赖
bun install

# 链接到全局 (可选)
bun link
```

## 🚀 使用指南

### 核心控制 (Core)

- `ot up` / `ot start`: 启动 Clash 核心（后台静默运行）。
- `ot down` / `ot stop`: 停止 Clash 核心。
- `ot status`: 查看核心运行状态、版本、内存占用、实时流量及订阅信息。
- `ot log`: 实时查看内核日志。

### 订阅管理 (Subscription)

- `ot sub add <url> [name]`: 添加订阅源。支持自动解析 Base64 和节点链接。
- `ot sub rm <name>`: 删除订阅源。
- `ot sub update <name>`: 更新指定订阅源。
- `ot sub use <name>`: 切换当前使用的订阅源。
- `ot sub ls`: 列出所有订阅源。

### 代理管理 (Proxy)

- `ot ls`: 列出所有代理组及当前选中的节点。
- `ot use [node_name]`: 切换节点。支持模糊搜索。
  - `ot use -p <index>`: 通过序号切换 `Proxy` 组节点。
  - `ot use -g <index>`: 通过序号切换 `GLOBAL` 组节点。
- `ot test`: 测试当前节点的延迟。
- `ot best`: 自动测试并切换到延迟最低的节点。

### 系统集成 (System)

- `ot on`: 开启 macOS 系统代理。
- `ot off`: 关闭 macOS 系统代理。
- `ot shell`: 输出当前 Shell 的代理环境变量命令（可直接 `eval $(ot shell)`）。
- `ot mode [rule|global|direct]`: 查看或切换代理模式（规则/全局/直连）。

### 交互式界面 (TUI)

- `ot ui`: 进入全屏交互式界面。

**TUI 快捷键**:

- `↑/↓`: 上下移动光标。
- `←/→` 或 `Tab`: 在代理组列表和节点列表之间切换。
- `Enter`: 选中节点或展开组。
- `s`: 快速开启/关闭系统代理。
- `m`: 切换代理模式 (Rule/Global/Direct)。
- `q`: 退出 TUI。

## 🛠️ 开发

本地运行：

```bash
bun run index.ts <command>
```

## 📝 许可证

GPL-3.0 License
