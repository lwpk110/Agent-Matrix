# Codex 3D 实时流视觉调研

调研日期：2026-10-18。目标是让 3D 拓扑像一段可读的运行回放随 Agent 事件推进，而不是只增加无关的背景动效。

## 产品参考

- [Langfuse — Sessions](https://langfuse.com/docs/observability/features/sessions)：把同一会话里的多条 trace 汇总为 Session Replay，支持重放完整交互，以便调试与分析。采用点：按事件时间线播放，回看的是完整交互链，而不是随机循环粒子。
- [Grafana — Set up Grafana Live](https://grafana.com/docs/grafana/latest/setup-grafana/set-up-grafana-live/)：将 Grafana Live 描述为事件发生后推送数据的实时消息引擎，并明确这是受网络和运行时延迟影响的 soft real-time。采用点：每次视觉更新应有事件作为依据，并显示当前事件/进度；连续动画本身不能被误读为真实数据。

## 设计应用

- 固定节点布局作为空间参照；本轮事件高亮当前节点与关联节点，只沿 `runtimeFlow(event)` 返回的有效方向发送一次脉冲。
- 提供播放/暂停、时间线拖动和 1×/2×/4×速度。拖动即暂停并定位到事件，继续后从该位置播放；播放结束时保留最后事件供查看。
- 等待审批时高亮门禁但不发送成功流量；失败事件使用失败状态，不伪造成功回流；真正的工具结果返回时才出现反向脉冲。
- 兼容 `prefers-reduced-motion`：关闭持续运动，但保留回放状态、节点颜色和事件进度更新。

## 数据边界

当前 3D 页面使用 `createCodexRuntimeMock()` 固定模拟会话，事件间隔为演示速度，不是真实 WebSocket 流。控件复现可观测产品的 session replay/live-update 交互模型；真实接入后必须以服务端事件及其时间戳驱动同一视觉投影，并展示连接状态和数据延迟。
