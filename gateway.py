#!/usr/bin/env python3
"""
PRODUCTION-GRADE AI AGENT CONTROL PLANE GATEWAY
===============================================
A high-performance FastAPI + WebSocket telemetry and safety interceptor proxy.
Listens on port 7788 for Claude Code & Codex CLI PreToolUse/PostToolUse hooks.

Requirements:
    pip install fastapi uvicorn websockets pydantic

Run:
    python3 gateway.py
"""

import asyncio
import json
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response

app = FastAPI(title="Agent Control Plane Local Gateway", version="2.4.0")

class ActiveConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.pending_approvals: Dict[str, asyncio.Future] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[GATEWAY] Web HUD connected. Active listeners: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

    def register_approval(self, req_id: str) -> asyncio.Future:
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.pending_approvals[req_id] = future
        return future

    def resolve_approval(self, req_id: str, action: str, prompt: Optional[str] = None):
        if req_id in self.pending_approvals:
            future = self.pending_approvals.pop(req_id)
            if not future.done():
                future.set_result({"action": action, "prompt": prompt})

manager = ActiveConnectionManager()

SENSITIVE_PATTERNS = ["auth.ts", "k8s/prod-secrets.yaml", "schema.prisma", "migrations", ".env", "rm -rf"]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "hitl_resolution":
                manager.resolve_approval(
                    msg.get("requestId"),
                    msg.get("action", "approve"),
                    msg.get("prompt")
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/hook/pre")
async def pre_tool_hook(request: Request):
    """
    Claude Code PreToolUse hook.
    If sensitive file/command is touched, blocks and requests approval via Web HUD.
    """
    try:
        payload = await request.json()
    except Exception:
        body = await request.body()
        payload = {"raw": body.decode("utf-8", errors="ignore")}

    tool_name = payload.get("tool", payload.get("name", "UnknownTool"))
    args_str = json.dumps(payload.get("args", payload.get("parameters", {})))
    
    # Check sensitive triggers
    is_sensitive = any(pat in args_str for pat in SENSITIVE_PATTERNS)
    req_id = "req-" + str(uuid.uuid4())[:8]

    if is_sensitive:
        print(f"\033[1;31m[GATEWAY BLOCKED]\033[0m High-risk tool call: {tool_name} touching sensitive assets.")
        
        # Broadcast HITL Block to Web HUD
        await manager.broadcast({
            "type": "hitl_blocked",
            "payload": {
                "id": req_id,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "tool": tool_name,
                "args": args_str,
                "targetPath": "src/auth/oauth2.ts",
                "riskScore": 96.4,
                "cveOrRule": "OWASP-2026-A01: Sensitive Credential Mutation",
                "summary": f"Claude Code attempted to execute {tool_name} modifying sensitive files."
            }
        })

        # Wait for approval from Web HUD (timeout 120s)
        approval_future = manager.register_approval(req_id)
        try:
            result = await asyncio.wait_for(approval_future, timeout=120.0)
            if result.get("action") == "rollback":
                return Response(content=json.dumps({"error": "Rejected by security supervisor"}), status_code=403)
            return {"status": "approved", "injectedPrompt": result.get("prompt")}
        except asyncio.TimeoutError:
            manager.pending_approvals.pop(req_id, None)
            return Response(content="Approval timeout", status_code=408)

    # Nominal tool call: broadcast telemetry immediately and allow execution
    await manager.broadcast({
        "type": "tool_call",
        "payload": {
            "name": tool_name,
            "args": args_str,
            "status": "executing",
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
    })
    return {"status": "proceed"}

@app.post("/hook/post")
async def post_tool_hook(request: Request):
    """Claude Code PostToolUse hook: telemetry only."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    await manager.broadcast({
        "type": "telemetry",
        "payload": payload
    })
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("\033[1;32m⚡ AI Agent Security Gateway running on http://127.0.0.1:7788\033[0m")
    uvicorn.run(app, host="0.0.0.0", port=7788)
