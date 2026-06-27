# Reusing the ADR mechanism in another project

The skill is the prose in `dotclaude_folder/skills/adrjournal/` plus the TypeScript
CLI in `src/` (`cli.ts` and `commands/`). To add the mechanism to a different
repository:

## 1. Copy the files

```bash
# from this repo into the target repo
cp -r dotclaude_folder/skills/adrjournal   <target>/.claude/skills/adrjournal
cp -r src                              <target>/src        # cli.ts + commands/
```

The skill prose can also be copied with the bundled command —
`npx tsx src/cli.ts install <target>/.claude` writes it into
`<target>/.claude/skills/adrjournal/`. You still need the `src/` CLI and its
dependencies (below). Adjust the destinations to taste — the only hard
requirement is that the path you give the skill and the hook resolves to
`cli.ts`.

## 2. Install the Node dependencies

The CLI is TypeScript, run with `tsx`. In the target project make Node ≥20.12
available and install the runtime dependencies plus `tsx`:

```bash
npm install commander chalk zod
npm install -D tsx
```

`npx tsx` resolves these from the target's `node_modules`. If the target is not a
Node project, run `npm init -y` first to create a `package.json`.

## 3. Register the Stop hook

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
            "command": "npx tsx \"$CLAUDE_PROJECT_DIR/src/cli.ts\" nudge"
          }
        ]
      }
    ]
  }
}
```

## 4. Tune the SIGNALS of the nudge command

`src/commands/nudge_command.ts` decides when to nudge from a small, clearly
marked SIGNALS block in `decisionReason()`. The defaults assume a Node/TypeScript
project (a new dependency in a `package.json`, a new top-level package, and
infra/schema/boundary files). For other stacks, edit that block:

- **Python** — watch `pyproject.toml` / `requirements.txt` additions, new
  top-level packages, `alembic/` migrations.
- **Go** — watch `go.mod` `require` additions, new top-level modules.
- **Rust** — watch `Cargo.toml` `[dependencies]` additions.

The rest of the command (once-per-session marker, "skip if an ADR was already
touched", non-blocking `systemMessage`) is project-agnostic and needs no change.

## 5. Optional: change where records live

The CLI and hook both default to `docs/ADRs`. The hook honours an `ADR_DIR`
environment variable; the CLI takes the directory as a trailing argument. If a
project keeps records elsewhere, set `ADR_DIR` in the hook entry and pass the
directory to the CLI.

## What is and is not portable

- **Portable as-is:** the Nygard format, numbering, index maintenance, the
  interview and backfill workflows, the once-per-session non-blocking nudge.
- **Worth reviewing per project:** the SIGNALS block, the records directory, the
  installed Node dependencies, and whether `$CLAUDE_PROJECT_DIR` resolves (it is
  set by Claude Code; if you invoke the hook another way, pass an absolute path).
