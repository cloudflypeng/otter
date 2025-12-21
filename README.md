# otter

Otter (ot) is a Clash TUI client designed for minimalism, speed, and composability.

## Installation

```bash
bun install
```

## Usage

### Core Commands
- `ot up` / `ot start`: Start Clash core (silent background run).
- `ot down` / `ot stop`: Stop Clash core.
- `ot status`: Check current connection status, core version, memory usage.
- `ot log`: Real-time scrolling kernel logs.

### Proxy Management
- `ot ls`: List all proxy groups and currently selected nodes.
- `ot use [node_name]`: Switch node. Supports fuzzy search.
- `ot test`: Test latency of the current node.
- `ot best`: Automatically test speed and switch to the lowest latency node.

### System Integration
- `ot on`: Enable system global proxy.
- `ot off`: Disable system proxy.
- `ot shell`: Enable proxy for the current terminal session only.

### TUI Mode
- `ot ui`: Enter full-screen interactive interface.

## Development

To run locally:

```bash
bun run index.ts <command>
```
