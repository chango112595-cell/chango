# Master Task Priorities — 2025-09-27

## Priority 0 — MCP Connector Bring-Up (NEW)
- Stand up wss:// endpoint `/mcp` with token auth (MCP_TOKEN secret)
- Health-check from desktop ChatGPT custom connector
- Tools exposed: list_files, write_file (isolated), read_file (ro)
- Success = ChatGPT can list repo + write a test file via MCP

## Priority 1 — Lab Log & Checkpoints (READY)
- Status: ✅ Active. Auto notes via Admin Patch logs + checkpoints for rollback.