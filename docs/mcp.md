# MCP integration

BotVisibility scans for [Model Context Protocol](https://modelcontextprotocol.io) (MCP) support as part of its Level 1 and Level 3 checks. Sites that expose MCP tool schemas let AI agents skip manual API discovery and call your tools directly.

---

## Checks

### 1.12 MCP Server (Level 1 — Discoverable)

**What it checks:** A discovery file at `/.well-known/mcp.json` describing your MCP server endpoint and available tools.

**Why it matters:** Without a discovery file, agents must guess whether your site supports MCP and attempt to probe endpoints. With it, they know exactly where your server is and what tools it exposes — zero guessing, no wasted tokens.

**How to pass:**

```json
// /.well-known/mcp.json
{
  "name": "My App MCP Server",
  "description": "Tools for interacting with My App",
  "version": "1.0.0",
  "endpoint": "https://yourapp.com/mcp",
  "tools": [
    {
      "name": "search",
      "description": "Search for items in the catalog",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search term" }
        },
        "required": ["query"]
      }
    }
  ]
}
```

Serve this file with `Content-Type: application/json` and no auth required.

---

### 1.18 WebMCP (Level 1 — Discoverable)

**What it checks:** A WebMCP endpoint declaration, enabling browser-accessible MCP tool calls via HTTP.

**Why it matters:** WebMCP allows agents running in browser contexts (web-based AI assistants, browser extensions, Claude.ai) to call your tools without server-side configuration.

**How to pass:** Expose MCP tools over HTTP at a `/mcp` endpoint and declare it in your `/.well-known/mcp.json` discovery file.

---

### 3.7 MCP Tool Quality (Level 3 — Optimized)

**What it checks:** That your MCP tools declared in `/.well-known/mcp.json` have complete definitions: a `name`, a human-readable `description`, and a JSON Schema `inputSchema` for each tool.

**Why it matters:** Incomplete tool definitions force agents to probe parameters by trial and error. Every failed call is wasted tokens and latency. A complete schema lets agents call your tools correctly on the first try.

**How to pass:** Every tool in your discovery file should include:

- `name` — unique identifier for the tool
- `description` — one or two sentences explaining what the tool does and when to use it
- `inputSchema` — a JSON Schema object listing all parameters with types and required fields

Partial credit is given when some tools have complete definitions.

---

## Further reading

- [Model Context Protocol spec](https://modelcontextprotocol.io/docs)
- [MCP tool schema reference](https://modelcontextprotocol.io/docs/concepts/tools)
- Full check list: [docs/checks.md](checks.md)

---

## Run a free audit on your site

Find out in seconds whether your site passes the MCP checks.

**[Run a free audit →](https://botvisibility.com)**

Or install the CLI:

```bash
npx botvisibility <your-url>
```
