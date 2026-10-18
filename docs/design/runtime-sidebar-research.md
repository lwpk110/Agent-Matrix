# Runtime 侧栏状态区

## 调研来源

- [Visual Studio Code — User interface](https://code.visualstudio.com/docs/editing/getting-started/userinterface)：将 Primary Side Bar 用于工作区视图，将 Activity Bar 用于视图切换及简短上下文指示，将 Status Bar 用于项目和当前文件状态。其信息层级按用途分区，而非压缩到同一条横向导航行。

## 应用到本原型

- 侧栏主区域继续负责 11 个 Runtime 步骤的导航。
- 本地工具、MCP 调用和权限确认属于当前会话的上下文状态，保留在侧栏底部，但以三个等宽、垂直堆叠的小指标呈现。
- 每项按“标签 → 数值 → 状态指示条”排列。固定最小列宽并裁切超长标签，避免把整行压成标签与数字互相争宽的 flex 内容。
- 页面主内容中的会话状态仍保留完整文字。侧栏只显示短标签和计数，减少重复说明。

## 复现到的问题

侧栏可用内容宽度为 175px。`.cp-side-bottom > div:first-child` 的 flex 规则以更高选择器优先级覆盖了 `.rt-channel-list` 的 grid 设置；三个带内联标签、数字和指示条的 flex 子项实际宽度合计超过侧栏，造成换行并溢出到主内容区。改为三列网格后，每个指标有明确的宽度约束。
