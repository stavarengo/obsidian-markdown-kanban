## Inspecting the running Obsidian app (Chrome DevTools MCP)

This repo ships a project MCP server (`chrome-devtools-obsidian` in `.mcp.json`) that drives a real Obsidian instance running on the **host** over the Chrome DevTools Protocol, for inspecting this plugin's UI and behaviour.

### Host prerequisites (a human sets these up — the agent cannot; they run outside the container)

1. Launch Obsidian on the host with remote debugging:
   ```bash
   obsidian --remote-debugging-port=9222
   ```
   (`--remote-debugging-address=0.0.0.0` is pointless — Chromium binds the port to
   the host's `127.0.0.1` regardless.)

2. Bridge that loopback-only port to the Docker interface so the container can reach it:
   ```bash
   socat TCP-LISTEN:9222,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:9222
   ```
   Runs foreground — keep the terminal open. To free the terminal instead:
   ```bash
   nohup socat TCP-LISTEN:9222,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:9222 >/tmp/socat-obsidian.log 2>&1 &
   ```

### How the connection works

`.mcp.json` points the MCP at `http://172.17.0.1:9222`:
- `172.17.0.1` is the host gateway *from inside the container* (= `host.docker.internal`); the firewall already allows it.
- It must be the **IP, not the hostname** — DevTools' DNS-rebind protection rejects domain-name `Host` headers (`host.docker.internal:9222` → refused) but accepts IP literals.

### For the agent

- Use the `chrome-devtools-obsidian` MCP tools to inspect Obsidian — **not** the global chrome-devtools plugin, which launches its own headless Chrome.
- If those tools can't connect, the host bridge (Obsidian + socat) is down. Ask the human to start it — you cannot run host-side commands yourself.