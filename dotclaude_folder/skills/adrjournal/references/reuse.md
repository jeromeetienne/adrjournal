# Reusing the ADR mechanism in another project

The skill is the prose in `dotclaude_folder/skills/adrjournal/` plus the published
[`adrjournal`](https://www.npmjs.com/package/adrjournal) CLI. Adding the mechanism
to a different repository takes two steps — install the prose and register the
hook — with no source checkout or build.

## 1. Install the skill prose

The bundled `install` command writes the skill files into a target agent folder:

```bash
npx adrjournal install <target>/.claude   # writes .claude/skills/adrjournal/
```

`npx` fetches the package on demand, so the only requirement is Node ≥20.12 in
the target environment. If the target is not a Node project, run `npm init -y`
first so `npx` has a `package.json` to work from.

## 2. Register the Stop hook

When the install target is a `.claude` folder, step 1 registers the
`npx adrjournal nudge` Stop hook automatically: it merges the entry into
`.claude/settings.json` (creating the file if absent), preserves any existing
settings and hooks, and is idempotent — re-running `install` reports the hook as
already present rather than duplicating it. The CLI prints the outcome
(`registered` / `already registered` / `skipped`).

You only need the manual merge below as a fallback — for a non-`.claude` target,
or to hand-tune the entry (for example, adding an `ADR_DIR` override per step 4).
Merge this into the target's `.claude/settings.json` (create the file if absent;
keep any existing hooks):

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx adrjournal nudge"
          }
        ]
      }
    ]
  }
}
```

## 3. Customising the nudge SIGNALS

The nudge fires from a small, clearly marked SIGNALS block in `decisionReason()`
inside the package's `nudge_command.ts`. The defaults assume a Node/TypeScript
project (a new dependency in a `package.json`, a new top-level package, and
infra/schema/boundary files). They work as-is for most stacks; for others —
Python (`pyproject.toml` / `requirements.txt`, `alembic/`), Go (`go.mod`), Rust
(`Cargo.toml`) — the signals simply won't fire, but nothing breaks.

To tailor the signals, clone [`jeromeetienne/adrjournal`](https://github.com/jeromeetienne/adrjournal),
edit the SIGNALS block in `src/commands/nudge_command.ts`, and point the hook at
your checkout (`npx tsx "<path>/src/cli.ts" nudge`) instead of the published CLI.

## 4. Optional: change where records live

The CLI and hook both default to `docs/ADRs`. The hook honours an `ADR_DIR`
environment variable; the CLI takes the directory as a trailing argument. If a
project keeps records elsewhere, set `ADR_DIR` in the hook entry and pass the
directory to the CLI.

## What is and is not portable

- **Portable as-is:** the Nygard format, numbering, index maintenance, the
  interview and backfill workflows, the once-per-session non-blocking nudge.
- **Worth reviewing per project:** the SIGNALS block, the records directory, and
  whether `$CLAUDE_PROJECT_DIR` resolves (it is set by Claude Code; if you invoke
  the hook another way, pass an absolute path).
