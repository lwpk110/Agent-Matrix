"""
AGENT MATRIX · NEURAL TREE - Native Terminal TUI (支持中英文国际化)
=================================================
A real-time cyberpunk terminal HUD dashboard for monitoring Claude Code
(Opus/Sonnet/Haiku) & OpenAI Codex (o3-pro/codex-1/codex-mini) multi-agent trees.

Usage:
    pip install rich textual
    python3 cli/agent_matrix.py [--mode claude|codex|hybrid] [--lang zh|en] [--speed normal|fast]
"""

import sys
import time
import random
import argparse
from datetime import datetime
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.live import Live

console = Console()

MODELS = {
    "claude": {
        "advisor": "Claude 3.7 Opus (Advisory/Guardrail)",
        "main": "Claude 3.7 Sonnet (Main Session Controller)",
        "router": "JEV Fork Router (Claude-Adaptive)",
        "subagents": "Claude 3.5 Haiku (Parallel Fleet x3)"
    },
    "codex": {
        "advisor": "o3-pro High-Reasoning Advisor",
        "main": "Codex-1 Architecture Lead",
        "router": "Monte-Carlo Fork Probability Engine",
        "subagents": "codex-mini Subagent Triad"
    }
}

SAMPLE_DIFFS = [
    """--- src/auth/oauth2.ts
+++ src/auth/oauth2.ts
@@ -42,7 +42,9 @@
-  const token = await legacyVerify(req.query.code);
+  // Mitigate CSRF & token exfiltration via state verification
+  const state = req.query.state as string;
+  const token = await secureOauthExchange(req.query.code, state);""",
    """--- src/parser/ast_walker.ts
+++ src/parser/ast_walker.ts
@@ -118,6 +118,8 @@
+  // AST node visitor for async arrow functions
+  export function visitCallExpression(node: ts.CallExpression) {
+    return sanitizeCallee(node.expression);
+  }""",
    """--- tests/e2e/workflow.spec.ts
+++ tests/e2e/workflow.spec.ts
@@ -88,4 +88,5 @@
+  expect(res.status).toBe(200);
+  expect(res.data.forkStatus).toBe("JEV_ROUTED_OPTIMAL");"""
]

def make_header(mode="claude", alert=False):
    grid = Table.grid(expand=True)
    grid.add_column(justify="left", ratio=1)
    grid.add_column(justify="right", ratio=1)

    title = Text()
    title.append(" ⚡ AGENT MATRIX ", style="bold black on bright_cyan")
    title.append(" · NEURAL TREE ", style="bold bright_white on grey11")
    title.append(f" [MODE: {mode.upper()}] ", style="bold yellow on grey15")

    if alert:
        title.append(" ⚠ HIGH RISK ALERT ACTIVE ", style="bold white on red blink")
    else:
        title.append(" ● ADVISORY LINK: SYNCED ", style="bold green on grey11")

    now = datetime.now().strftime("%H:%M:%S")
    right = Text()
    right.append(f"NODE: us-east-worker  |  CLOCK: {now}  |  STATUS: ACTIVE", style="dim cyan")

    grid.add_row(title, right)
    return Panel(grid, style="cyan", border_style="bright_blue")

def make_advisor_panel(alert=False):
    body = Text()
    body.append("STATE: ", style="bold")
    if alert:
        body.append("WOKEN (CRITICAL INTERVENTION)\n", style="bold red")
        body.append("• Scope escalation detected: OAuth2 Refresh Token Exfiltration Risk\n", style="yellow")
        body.append("• Invariant rule: SEC-402 strictly requires Opus signoff\n", style="bright_red")
        body.append("• Recommendation: Inject PKCE challenge + state cookie verification\n", style="bright_green")
        body.append("• Action: AST rewrite proposed and validated against OWASP-2026\n", style="cyan")
    else:
        body.append("STANDBY MONITORING (0.8% Risk Ceiling)\n", style="dim green")
        body.append("• AST Policy Check: PASSED (Zero illegal eval/fs mutations)\n", style="dim")
        body.append("• Advisory Gate: Auto-approve subagent AST outputs\n", style="dim")
        body.append("• Tokens: 42,891 prompt / 1,412 cached / 0 alert events\n", style="dim")

    body.append("\n[Keys: 'a' Trigger OAuth Alert | 'r' Resolve Advisor]", style="dim italic bright_magenta")
    return Panel(body, title="[bold magenta]◄ ADVISOR: OPUS / o3-pro[/bold magenta]", border_style="magenta" if not alert else "bold red")

def make_main_session():
    body = Text()
    body.append("PROMPT: ", style="bold")
    body.append("Refactor auth pipeline to use zero-trust OAuth2 with AST validation\n", style="bright_white")
    body.append("STEP: 04/09 · Dispatching semantic verification to parallel subagent fleet\n", style="bright_yellow")
    body.append("ACTIVE FILE: ", style="bold")
    body.append("src/auth/oauth2.ts (418 LOC)  |  BRANCH: feat/neural-auth\n", style="cyan")
    body.append("CONTEXT: ", style="bold")
    body.append("182.4k / 200k tokens (91.2% capacity) · Cost: $0.184 / session", style="dim")
    return Panel(body, title="[bold yellow]▲ MAIN SESSION: SONNET / CODEX-1[/bold yellow]", border_style="yellow")

def make_jev_router(step=0):
    p_inline = 0.12 + 0.05 * (step % 3)
    p_subagents = 0.78 - 0.04 * (step % 3)
    p_escalate = 1.0 - p_inline - p_subagents

    body = Text()
    body.append("DECISION HEURISTIC: JOINT EXPECTED VALUE (JEV) MULTI-FORK\n", style="bold bright_cyan")
    body.append(f"• P(inline single-shot): {p_inline:.2f}  [cost: low, confidence: 64%]\n", style="cyan")
    body.append(f"• P(parallel subagents): {p_subagents:.2f}  [cost: med, confidence: 96%]\n", style="bright_green")
    body.append(f"• P(advisor escalation): {p_escalate:.2f}  [risk gate: active]\n", style="bright_magenta")
    body.append("ROUTE: FORK_TO_TRIPLE_SUBAGENTS (Entropy: 0.42 bit)", style="bold bright_white on dark_cyan")
    return Panel(body, title="[bold cyan]◆ JEV FORK PROBABILITY ROUTER[/bold cyan]", border_style="cyan")

def make_subagents(step=0):
    grid = Table(expand=True, box=None)
    grid.add_column("Agent", style="bold green", ratio=1)
    grid.add_column("Task / Payload", ratio=2)
    grid.add_column("Status", ratio=1)

    workers = [
        ("Worker #01 [AST]", "Synthesizing AST Visitor in src/auth/oauth2.ts", "[bold green]RUNNING (89%)[/bold green]"),
        ("Explorer #02 [Docs]", "Indexing OAuth RFC 6749 & PKCE spec RFC 7636", "[bold cyan]INDEXED 4 docs[/bold cyan]"),
        ("Researcher #03 [Tests]", "Running Vitest suite: 112/112 suites passed", "[bold bright_green]PASS 112/112[/bold bright_green]")
    ]

    for name, task, status in workers:
        grid.add_row(name, task, status)

    return Panel(grid, title="[bold green]▼ DISPATCHER: HAIKU / CODEX-MINI (3x Parallel)[/bold green]", border_style="green")

def make_logs(logs):
    log_text = Text()
    for t, tag, color, msg in logs[-6:]:
        log_text.append(f"[{t}] ", style="dim")
        log_text.append(f"[{tag}] ", style=f"bold {color}")
        log_text.append(f"{msg}\n", style="white")
    return Panel(log_text, title="[bold bright_white]LIVE SESSION STREAM · FILE DIFFS & TELEMETRY[/bold bright_white]", border_style="grey50")

def main():
    parser = argparse.ArgumentParser(description="Agent Matrix Neural Tree TUI")
    parser.add_argument("--mode", default="claude", choices=["claude", "codex", "hybrid"])
    parser.add_argument("--lang", default="zh", choices=["zh", "en"], help="Interface language (zh: 中文, en: English)")
    parser.add_argument("--speed", default="normal", choices=["normal", "fast"])
    args = parser.parse_args()

    mode = args.mode
    lang = args.lang
    alert = False
    step = 0
    
    if lang == "zh":
        logs = [
            ("23:16:01", "SONNET", "yellow", "已在分支 feat/neural-auth 上初始化主会话 (PID: 88412)"),
            ("23:16:03", "ROUTER", "cyan", "JEV 联合期望分叉裁决: 并行子智能体集群调度 (P=0.82)"),
            ("23:16:05", "HAIKU-01", "green", "下发 AST 语法分析扫描至 14 个认证相关模块"),
            ("23:16:07", "HAIKU-02", "green", "解析 RFC 7636 PKCE 协议规范并写入语义上下文"),
            ("23:16:10", "HAIKU-03", "green", "执行自动化安全套件: 112/112 项测试用例全部通过"),
            ("23:16:12", "OPUS-ADV", "magenta", "持续安全不变量巡检: 零 AST 越权外泄风险 (风险值: 0.8%)")
        ]
        start_msg = "[dim]正在启动智能体矩阵终端 TUI... 按 Ctrl+C 退出。[/dim]"
    else:
        logs = [
            ("23:16:01", "SONNET", "yellow", "Initialized root session on feat/neural-auth"),
            ("23:16:03", "ROUTER", "cyan", "JEV fork evaluation computed: parallel_subagents (P=0.79)"),
            ("23:16:05", "HAIKU-01", "green", "Dispatched AST scanner across 14 authentication modules"),
            ("23:16:07", "HAIKU-02", "green", "Extracted RFC 7636 PKCE spec tokens into semantic context"),
            ("23:16:10", "HAIKU-03", "green", "Executing security suite: 112 test cases verified passing"),
            ("23:16:12", "OPUS-ADV", "magenta", "Continuous invariant check: Zero AST exfiltration triggers")
        ]
        start_msg = "[dim]Starting Agent Matrix TUI... Press Ctrl+C to exit.[/dim]"

    console.clear()
    console.print(start_msg)
    time.sleep(0.5)

    try:
        with Live(console=console, screen=True, refresh_per_second=4) as live:
            while True:
                layout = Layout()
                layout.split_column(
                    Layout(name="header", size=3),
                    Layout(name="main_split", ratio=3),
                    Layout(name="logs", size=8)
                )

                layout["main_split"].split_row(
                    Layout(name="advisor", ratio=2),
                    Layout(name="center", ratio=5)
                )

                layout["center"].split_column(
                    Layout(name="sonnet", ratio=2),
                    Layout(name="router", ratio=2),
                    Layout(name="subagents", ratio=3)
                )

                layout["header"].update(make_header(mode, alert))
                layout["advisor"].update(make_advisor_panel(alert))
                layout["sonnet"].update(make_main_session())
                layout["router"].update(make_jev_router(step))
                layout["subagents"].update(make_subagents(step))
                layout["logs"].update(make_logs(logs))

                live.update(layout)
                time.sleep(0.8 if args.speed == "normal" else 0.4)
                step += 1

                # Periodic simulated activity
                if step % 5 == 0:
                    t = datetime.now().strftime("%H:%M:%S")
                    if lang == "zh":
                        event_types = [
                            ("HAIKU-01", "green", f"AST 语法访问器成功打补丁语句 #{random.randint(10, 99)}"),
                            ("ROUTER", "cyan", f"信息熵刷新: {random.uniform(0.35, 0.48):.3f} bit"),
                            ("SONNET", "yellow", f"合并来自子智能体 #{random.randint(1, 3)} 的 AST 补丁"),
                            ("HAIKU-03", "green", "安全回归校验: 112/112 套件全绿 (0 违规)")
                        ]
                    else:
                        event_types = [
                            ("HAIKU-01", "green", f"AST Node visitor patched statement #{random.randint(10, 99)}"),
                            ("ROUTER", "cyan", f"Entropy refreshed: {random.uniform(0.35, 0.48):.3f} bit"),
                            ("SONNET", "yellow", f"Merged partial AST diff from subagent worker #{random.randint(1, 3)}"),
                            ("HAIKU-03", "green", "Regression check: 112/112 suites green (0 failures)")
                        ]
                    agent, col, msg = random.choice(event_types)
                    logs.append((t, agent, col, msg))
                    if len(logs) > 30:
                        logs.pop(0)

    except KeyboardInterrupt:
        console.print("\n[bold cyan]Agent Matrix terminated cleanly.[/bold cyan]")

if __name__ == "__main__":
    main()
