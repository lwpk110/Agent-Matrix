#!/usr/bin/env bash
# ==============================================================================
# OpenAI Codex CLI Telemetry & Safety Wrapper
# Intercepts codex executions and streams telemetry to local gateway on port 7788
# ==============================================================================

GATEWAY_URL="http://localhost:7788/hook/pre"

CMD_PAYLOAD=$(cat <<EOF
{
  "agent": "codex-1",
  "command": "$*",
  "cwd": "$(pwd)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

# Send pre-execution telemetry check
RESPONSE=$(curl -s -X POST "$GATEWAY_URL" \
  -H "Content-Type: application/json" \
  -d "$CMD_PAYLOAD")

if [[ "$RESPONSE" == *"Rejected by security supervisor"* ]]; then
  echo -e "\033[1;31m[CODEX BLOCKED]\033[0m Action was rejected by Web HITL Gatekeeper."
  exit 1
fi

# Execute native codex command
if command -v codex &> /dev/null; then
  codex "$@"
else
  echo -e "\033[1;32m[CODEX SIMULATED]\033[0m Executed: codex $*"
fi
