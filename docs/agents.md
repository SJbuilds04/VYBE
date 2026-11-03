# Using VYBE with each agent

VYBE follows the open [Agent Skills](https://agentskills.io) format: each skill is a folder with a
`SKILL.md`. The instructions are agent-neutral; only discovery and invocation differ.

| Agent | Project install | User install | Invoke |
| --- | --- | --- | --- |
| Claude Code | `npx skills add SJbuilds04/VYBE --skill '*' -a claude-code` → `.claude/skills/` | add `-g` → `~/.claude/skills/` · or `/plugin marketplace add SJbuilds04/VYBE` then `/plugin install vybe@vybe` | `/vybe …` (plugin installs: `/vybe:vybe …`) |
| Codex CLI | `… -a codex` → `.agents/skills/` | `-g` → `~/.agents/skills/` | "use the vybe skill to …" or `$vybe` where supported |
| Cursor | `… -a cursor` → `.agents/skills/` | `-g` → `~/.cursor/skills/` | ask in Agent mode: "/vybe …" or "use vybe to …" |
| OpenCode | `… -a opencode` → `.agents/skills/` | `-g` → `~/.config/opencode/skills/` | "use the vybe skill …" |
| Others | copy `skills/*` into the agent's skills dir, or point its instructions at `skills/vybe/SKILL.md` | | describe the video |

Inside a clone of this repository, `.claude/skills/` and `.agents/skills/` already link to
`skills/`, so Claude Code, Codex, Cursor and OpenCode discover all eight skills when started in
the repo folder. Run `npm run link` if your checkout turned the links into text files.

## Agent capabilities that matter

- **Shell access** — required (the engine is `node …/vybe.mjs`, rendering is `npx hyperframes`).
- **Long-running commands** — renders take minutes. If your agent kills commands after a timeout,
  run renders in the background (Claude Code does this automatically when asked) and wait for the file.
- **Vision** — used for Stage 8 visual QC on extracted frames. Without it, VYBE runs the
  deterministic checks and says the visual review was not performed.
- **Skill chaining** — when the HyperFrames skills are installed alongside, VYBE reads them as the
  authority on the composition contract (`npx skills add heygen-com/hyperframes`).
