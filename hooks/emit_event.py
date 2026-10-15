#!/usr/bin/env python3
"""
AGENT MATRIX · EVENT EMITTER HOOK
==================================
Claude Code and Codex hook script that emits structured telemetry events
into the Agent Matrix neural tree HUD via JSON-RPC / WebSocket / stdout.

Usage in Claude Code settings or git hooks:
    python3 hooks/emit_event.py --event tool_call --agent sonnet --tool Bash --cmd "git status"
    python3 hooks/emit_event.py --event fork --router jev --p_inline 0.15 --p_subagents 0.82
    python3 hooks/emit_event.py --event risk_alert --agent opus --severity critical --reason "OAuth Token Leak"
"""

import sys
import json
import argparse
from datetime import datetime

def parse_args():
    parser = argparse.ArgumentParser(description="Emit Agent Matrix Event")
    parser.add_argument("--event", default="tool_call", choices=["tool_call", "fork", "risk_alert", "ast_diff", "subagent_tick"])
    parser.add_argument("--agent", default="sonnet", help="Agent identifier (opus, sonnet, haiku, o3-pro, codex-1, codex-mini)")
    parser.add_argument("--tool", default="Bash", help="Tool invoked (Bash, FileEdit, Grep, ASTParse)")
    parser.add_argument("--cmd", default="", help="Command or argument payload")
    parser.add_argument("--diff", default="", help="Diff snippet or file target")
    parser.add_argument("--severity", default="low", choices=["low", "medium", "high", "critical"])
    parser.add_argument("--reason", default="", help="Reason for advisory alert")
    parser.add_argument("--p_inline", type=float, default=0.14)
    parser.add_argument("--p_subagents", type=float, default=0.81)
    parser.add_argument("--json", action="store_true", help="Output pure JSON")
    return parser.parse_args()

def main():
    args = parse_args()
    timestamp = datetime.now().isoformat()

    payload = {
        "timestamp": timestamp,
        "event_type": args.event,
        "agent": args.agent,
        "data": {
            "tool": args.tool,
            "cmd": args.cmd,
            "diff": args.diff,
            "severity": args.severity,
            "reason": args.reason,
            "probabilities": {
                "p_inline": args.p_inline,
                "p_subagents": args.p_subagents,
                "p_escalate": round(1.0 - (args.p_inline + args.p_subagents), 3)
            }
        }
    }

    if args.json:
        print(json.dumps(payload))
    else:
        print(f"\033[1;36m[AGENT MATRIX HOOK]\033[0m Emitted {args.event.upper()} event from \033[1;33m{args.agent}\033[0m:")
        print(json.dumps(payload, indent=2))

if __name__ == "__main__":
    main()
