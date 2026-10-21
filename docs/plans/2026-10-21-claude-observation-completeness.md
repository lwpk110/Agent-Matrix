# Claude 观测数据与核心状态修复

## 范围与授权

用户反馈真实 Claude Code 任务已执行，但模型、推理档位等统计仍缺失，推理核心图标/颜色没有随 Agent 与状态更新，Claude Desktop 未接入。2026-10-21 用户明确同意读取 Desktop 本地日志以提取统计元数据；不保存或展示提示词、回答、工具输出。

沿用多 Agent 观测站插件架构，保留 Codex 兼容。本轮不访问浏览器 cookie、认证配置或 IndexedDB；无受支持本地记录的普通 Desktop Chat 不标记为已接入。

## 实施清单

| ID | 类型 | 负责人 | 依赖 | 交付 |
| --- | --- | --- | --- | --- |
| P | plan | global_planner_astra | 无 | 只读定位现有字段投影、视觉契约与可用数据源，已完成 |
| C | implement | claude_runtime_impl | P | Hook effort 白名单与模型来源、旧 journal 兼容、跨回合元数据回溯 |
| D | implement | claude_metadata_impl | P | 本地日志统计白名单解析、受限读取、Code telemetry 与独立 Desktop 统计 API |
| V | implement | claude_runtime_impl | C/D 接口约定 | Desktop 统计页面、插件视觉身份、2D/3D 核心品牌与状态色一致 |
| Q | verify | 主 agent | C/D/V | 真实服务 API 与浏览器核对，相关回归、lint/build/diff 检查 |
| R | review | global_reviewer_sol | Q | 稳定实际 diff 只读审查，定向修复后复核 |

两位实现者按文件所有权并行：统计读取器、测试与 server.ts 由 metadata 实现者独占；Hook、前端投影、类型与视图由 runtime 实现者负责。主 agent 维护文档与最终验证；不改用户本机 `.claude/settings.json`，不清除运行时历史。

## 验收重点

- effort 字符串和对象形式均规范化；模型标明 Hook 宣告或实际请求统计来源。
- Code telemetry 仅在 session/turn 有明确对应关系时绑定，不能将其他回合用量补入当前回合。
- token 保留原生 input/cache read/cache creation；上下文总输入明确合计口径，不把原生 input 当作完整上下文。
- Desktop 输出严格限于来源、会话/回合标识、时间、模型、推理档位、请求计数、用量和时长；无正文、工具结果、原始路径。
- 读取具备文件/字节上限、缺失/不可访问源状态、增量与半行容错，不跟随越界符号链接。
- 2D/3D 随插件更换图标与品牌色，异常/压缩状态色优先；3D 材质能更新。
- 自建 fixture 覆盖脱敏边界，不把真实用户日志放入仓库和测试输出。
- Codex、Claude 与第三插件回归通过，未知字段仍保持未知。

## 验证结果（2026-10-21）

- Claude runtime 38 项、Codex runtime 34 项、runtime observation 5 项、runtime views 8 项、topology 5 项通过；原型与动效测试纳入 `test:codex-prototype`。类型检查、生产构建及 diff 检查通过。
- 已使用本机 Code 与 Desktop 会话核对模型、推理档位、输入缓存分项、输出和请求数，未复制真实日志或具体会话统计作为 fixture 或公开文档。缺少原生时长记录时保持未知。
- 浏览器验证了 Claude 2D、3D 和 Desktop 统计页的真实字段、品牌核心与图标、完成状态、模型来源和输入分项；Codex 2D/3D 对照正常，无演示数据混入。节点详情验证了结构统计、快照来源与继承范围。
- 新统计 API 对外部 Origin 及伪造攻击者 Host/Origin 均返回 403；API 不返回提示词、回答、工具输出和日志路径。
- 只读复审发现的长链裁剪、缓存淘汰、未知值、请求 usage 合并与 Host 校验问题已修复并通过定向复核；最终结论为 ship。

## 动效与文档收尾

- 真实回合同批事件逐条去重，视觉提示采用有限队列；首次历史加载不自动回放，新增输入、结构快照及请求计数分别提供可观测证据。
- 视觉提示不写入 RuntimeEvent 或 journal，不增加真实请求与工具调用计数；等待、失败和纯生命周期记录不生成成功流。
- transcript 工具统计可独立进入叶子及详情；MCP 搜索与直接搜索互斥分类，Hook 调用继续保留已有结果。
- README 使用虚构演示路由录制的多帧 GIF，并明确真实采集、未知字段和隐私边界；本机配置与真实日志排除在提交之外。

## 保留的边界

只展示明确采集到的统计。普通 Desktop Chat、未暴露的上下文容量/记忆快照、完整系统指令和未提供的时长仍不能补造。读取超出预算时增量继续；旧历史超出缓存窗口时以 `truncated` 提示仅保留最近统计。长链行为用合成数据覆盖，未额外启动付费 Claude 请求进行长会话压力验收。
