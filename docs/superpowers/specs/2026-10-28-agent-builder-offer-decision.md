# Decision note — BotVisibility's offer for agent builders (2026-10-28)

**Status:** product direction only. No implementation implied. The choice below
is my recommendation from the brainstorm; it is the user's to overturn.

## The problem

Every BotVisibility surface today is built for the **site owner**: "here is how
ready *your* site is for agents, and here is your homework to fix it." Agent and
framework builders are the other side of the market — they don't have a site to
improve, they have an agent that must act on *someone else's* messy site. The
product has never defined what it offers them, so no implementation direction
can be chosen yet. This note picks one job.

## The four surfaces today (who each serves)

| Surface | What it is | Who it serves | Output |
|---|---|---|---|
| **CLI** (`npx botvisibility <url\|path>`) | Zero-dep external scanner, 58 checks | Site owner / CI | Human remediation report |
| **MCP server** (`/api/mcp`) | `scan_url`, `compare_sites`, `deep_scan` (paid), `get_recommendations`, `validate_llms_txt`, … | An agent, on demand | Same remediation report, agent-invoked |
| **58-check spec** (`docs/checks.md`, `scoring.md`) | The standard / knowledge artifact | Implementers, the ecosystem | The checklist itself |
| **Managed-agent package** (`botvisibility-claudeagent`) | Packaged "BotVisibility Checker" Claude agent | End users wanting a conversational audit | Narrated remediation report |

**Common limitation:** all four emit a *site-owner remediation report*
(pass/fail + "fix this"). None emit a *consumer-oriented* answer to "how should
my agent act on this site?"

## Brainstorm — jobs considered (and why dropped)

- **A. Pre-flight capability probe** *(chosen)* — before my agent acts on an
  unfamiliar site, tell it programmatically the cheapest reliable way to
  interact (and whether to bother).
- **B. Target allow/deny gate** — a boolean/level a framework branches on to
  attempt vs. escalate. *Falls out of A as one output field; not its own job.*
- **C. Agent-tax cost estimator** — predicted token cost of acting on a target,
  for budgeting/routing. *Also an output of A; `agent-tax.md` is the seed but
  it's a marketing doc today, not an API field.*
- **D. Conformance badge / ecosystem standard** — certify sites agents can
  trust. *Mostly promotion/standards, which this task excludes.*
- **E. Agent eval harness** — test an agent against a corpus of sites at known
  readiness levels. *A QA tool, narrower; serves testing, not the live
  integration decision. Secondary.*

A is the only job **unique to agent builders** (B/C are its outputs, D is
promotion, E is QA), and it reuses the existing scanner engine almost whole —
so it's the highest-leverage, smallest-gap move.

## The decision

- **Chosen agent-builder job:** *Pre-flight capability probe* — "Before my agent
  acts on a site it doesn't know, tell it the cheapest reliable way to interact
  with it, and whether it should attempt automated action at all."

- **Offer:** a **machine-first capability manifest** (not a remediation report).
  Given a URL, return the agent-relevant facts the engine already collects:
  which interaction paths exist (llms.txt / OpenAPI / MCP / agent-card / feeds),
  auth and payment requirements (incl. x402), browser-agent viability (CORS), a
  gate-ready readiness level, and an estimated agent-tax — framed as "here is how
  to use this site" rather than "here is your homework."

- **Delivery surface:** the **MCP server**. Agents already speak MCP, and
  `scan_url`/`deep_scan` already run the full engine; this is where an
  agent-facing manifest response belongs. The CLI and managed-agent stay pointed
  at site owners. (One surface, two audiences, split by output shape.)

- **Capability gap:** purely **output shape and framing**, not scanning power.
  The 58 checks already detect every needed signal (llms.txt, OpenAPI, MCP,
  agent-card, CORS, auth, x402). What's missing: (1) a consumer-oriented manifest
  shape keyed to "how should an agent act," (2) an explicit recommended
  interaction path ("use OpenAPI at /openapi.json; auth via X; pays via x402"),
  (3) a gate-ready level/boolean contract a framework can branch on, and (4) the
  agent-tax figure exposed as a response field instead of a doc. That the gap is
  framing, not capability, is exactly why this is a cheap, high-leverage bet.

## Not in scope here

No manifest schema, endpoint design, or tool naming — those are implementation
and come next only if this direction is approved.
