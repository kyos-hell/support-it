# support-it

An AI toolbox for IT support technicians, running inside Claude Code.

A technician types `/support` followed by a ticket. The model triages it, loads the matching
skill (network, system, workstation, hardware, identity, application), reads the company
context, drives the diagnosis **one question or one command at a time**, proposes a numbered
action plan, and closes the ticket. Resolved tickets can be published to a local knowledge
base that the next diagnosis will search. Nothing is executed by the AI: **it guides, the
technician executes.**

> The product itself (skills, messages, documentation) is in **French** — it is built for
> French-speaking support teams. This README is the English entry point.

## How it works

Two parts, one folder each:

- **`produit/contenu/`** — what the model reads: the domain manifest (signals, tags), the
  triage / closure / context-filling skills, one skill per domain, and empty context templates.
  Plain Markdown and YAML. No code.
- **`produit/serveur/`** — an MCP server (TypeScript, Node.js) that exposes nine tools. It
  never reasons: it serves skills, stores drafts and tickets, searches the knowledge base and
  writes the company context — deterministically, in `installation/`, and nowhere else.

The company's own data (context, drafts, tickets, knowledge base) lives in **`installation/`**,
created at install time, never shipped and never versioned.

```
produit/
  install.ps1 · install.sh      one command, six steps
  contenu/                      manifest, skills, context templates (French)
  serveur/                      the MCP server + CLI
  entrees/claude-code/          /support entry point, permission settings
installation/                   created by install — your data, never committed
conception/                     design notes, decisions, test campaigns (French)
```

## Install

Prerequisites: **Node.js ≥ 18** (with npm) and **Claude Code** (desktop app or CLI). The script
offers to install Node.js through your package manager if it is missing.

```bash
git clone https://github.com/kyos-hell/support-it.git
cd support-it
powershell -ExecutionPolicy Bypass -File produit/install.ps1     # Windows
./produit/install.sh                                             # macOS / Linux / Git Bash
```

The script runs six steps: prerequisites → build → validation + smoke test → `installation/`
(templates copied, never overwritten) → Claude Code registration (`.mcp.json`, `/support`
skill, `.claude/settings.json`) → status + audit. Re-running it is safe: it joins an existing
installation and touches nothing.

Then **restart Claude Code from the repository folder** (the parent of `produit/`) and type
`/support`. The first call proves the server answers. Fill the company context by
conversation (`/support remplis le contexte`) or by editing `installation/contexte/*.md`.

> **Always open Claude Code in the `support-it` folder itself** — in the desktop app, pick
> `support-it` as the session folder; in a terminal, `cd support-it` then `claude`.
> The three pieces live there and nowhere else: the `/support` skill
> (`.claude/skills/support/`), the MCP server (`.mcp.json`) and the permission rules
> (`.claude/settings.json`). Since `0.3.1`:
>
> - **Outside that folder**, `/support` and the server do not exist — on purpose: a ticket
>   must never run without the permission rules.
> - **Never from a subfolder** (e.g. `support-it/produit/`). In a git clone, Claude Code
>   still finds `/support` and the server by looking up to the repository root — but **not**
>   the permission rules: the model gets `Bash`/`PowerShell` back and could write into
>   `installation/`. Tested on 2026-09-23; a server-side guard is planned for `0.3.2`.
> - If an older `~/.claude/skills/support/` exists, the installer removes it (it would
>   override the project skill and leak outside the folder); `node dist/cli.js etat` warns if
>   one is still there.

Useful options: `-SansBuild` / `--sans-build`, `-SansTest` / `--sans-test`,
`-Installation <path>` / `--installation <path>` (e.g. a network share).

## Daily use

| You type | What happens |
| --- | --- |
| `/support INC-1234 : the Agency site lost its file share since 8am` | triage, skill loaded, diagnosis one step at a time, plan, closure, optional publication |
| `/support INC-1234` | resumes a ticket in progress (after a restart, a pause, or from a colleague) |
| `/support remplis le contexte` | fills the company context section by section, with your explicit yes before each write |
| `/support audit` | the installation report: old drafts, unpublished tickets, stale context, candidate updates — proposed one by one, nothing written without a yes |

Three human validation points, always: an ambiguous triage, the action plan, the publication.

## The nine MCP tools

The model calls them in this order; the server refuses calls out of sequence.

| Tool | Role |
| --- | --- |
| `load_skill(domaines, nature)` | Serves the triage, a domain skill (incident or request), `cloture`, `remplissage` or `audit`, with the required context sections already attached. |
| `get_context(sections)` | Serves context sections on demand (`reseau/dns-dhcp`…). An empty section comes back with its template and instruction: ask, never assume. |
| `save_progress(...)` | Creates or updates the draft of the ticket in progress: symptom as stated, checked signals with evidence, questions and answers, verifications, plan, actions, notes, `pause`. One line per fact, length-limited. |
| `resume_ticket(reference?)` | Lists drafts in progress, or reloads one and rebuilds the session state (skills, sections served, cases read). |
| `search_kb(tags)` | Searches the knowledge base by tags, ranked by rarity. Empty at the beginning — that is normal. |
| `read_kb(ticket_id)` | Reads one published case in full, after a search, before reusing its conclusion. |
| `save_ticket(...)` | Closes the ticket: the draft is the source of truth (symptom, domains, plan, questions, duration); status `resolu`, `non-resolu`, `hors-domaines-couverts` or `escalade-externe`; tags checked against the library; context updates proposed to the referent. |
| `publish_kb(ticket_id, tags?)` | Copies a resolved ticket into the knowledge base — only after the technician's explicit yes. |
| `update_context(section, contenu)` | Writes one context section, after the technician's yes; keeps the template instructions, dates the section, refuses a table whose columns differ from the expected ones. |

What the model cannot choose is enforced by the server: domains, signals, tags and section
identifiers are enums built from the manifest; identifiers, paths and dates are fabricated by
the server; the draft — not the model's memory — feeds the final ticket. Claude Code's
`.claude/settings.json` (deposited by the installer) removes `Bash`/`PowerShell` from the model
and forbids writing into `installation/` outside the MCP calls.

## CLI (for the referent)

From `produit/serveur/`, after `npm run build`:

```bash
node dist/cli.js etat        # context filling status, drafts in progress
node dist/cli.js audit       # the same report as /support audit, written to installation/audits/
node dist/cli.js valider     # delivery checks: manifest, skill/template contract, lengths, no company data
node dist/cli.js tester      # smoke test of the built server (temporary folder only)
```

Environment variables `SUPPORT_IT_PRODUIT` and `SUPPORT_IT_INSTALLATION` override the two
roots (defaults: the `produit/` folder of the server, and `installation/` next to it).

## Contributing

Read, in this order: `conception/etat-d-avancement.md` (where we are, the invariants, the
checklist per kind of change), `conception/plan.md` section 0 (vocabulary and founding
decisions), `conception/fin-de-projet.md` (what is delivered, decisions taken).

Rules that are not up for discussion:

- Everything in the product is in **French** — code, comments, messages, skills.
- **No company data** in `produit/contenu/`, not even as an example; placeholders `<…>` only
  (`valider` checks it).
- The model never fabricates a path, an identifier or a date; nothing is written outside
  `installation/`; the context is never written without the technician's yes.
- A skill is ~100 lines (110 max); a rule beats a description.

After any change, from `produit/serveur/`:

```bash
npm run build && node dist/cli.js valider && npm test
```

Then one line in `conception/validation.md` §7 and, for a decision, one numbered line with
its reason in `conception/fin-de-projet.md` §4.

Bug reports and field feedback go to `conception/retours-beta.md` first — one line per
observation — before anything is changed in `produit/`.

## Status

`0.3.1` (2026-09-23): the `/support` entry point moved to project scope — it no longer
loads outside the `support-it` folder. `0.3.0` (2026-09-21): two test campaigns have been played and their corrections applied
(`conception/campagne-test-0.3.0-beta*.md`): eleven tickets on a generated dataset, then a
fresh install with an empty context, then a pass on the manifest. Next: the multi-user
"gate 2" (network share, concurrent drafts) and a redrawn architecture diagram.
