import Fs from 'node:fs';
import Path from 'node:path';
import { AdrStore } from '../adr_store.js';

/** Per-record template written by `scaffold`. The first line is rewritten on `create`. */
const TEMPLATE_MD = `# NNNN. <Short title of the decision>

- Status: proposed
- Date: <YYYY-MM-DD>
- Deciders: <people / roles involved>

## Context

<The forces at play: the situation, constraints, and problem that make a
decision necessary. State the facts neutrally — this is the "why now".>

## Decision

<The change we are making, stated in active voice: "We will …".>

## Consequences

<What becomes easier and what becomes harder as a result. Include the
trade-offs we accept, the risks, and any follow-up work the decision creates.>
`;

/** The 0000 meta-ADR recording the decision to keep ADRs at all. */
const META_ADR_MD = `# 0000. Record architecture decisions

- Status: accepted
- Date: <YYYY-MM-DD>
- Deciders: <team>

## Context

We want to capture the significant architectural decisions made on this project,
together with their context and consequences, so that newcomers and our future
selves can understand why the system is the way it is.

## Decision

We will use Architecture Decision Records, as described by Michael Nygard in
https://www.cognitect.com/blog_posts/2011/11/15/documenting-architecture-decisions

Each record is a short markdown file in \`docs/ADRs\`, numbered sequentially and
never deleted. When a decision is reversed, we add a new record that supersedes
the old one rather than editing history.

## Consequences

The reasoning behind the architecture is preserved and reviewable. The cost is
the small, ongoing discipline of writing a record when a real decision is made.
`;

/** The index README created by `scaffold` and maintained by `reindex`. */
const README_MD = `# Architecture Decision Records

This directory records the significant architecture decisions for this project,
in the format described by Michael Nygard. Each file is one decision; records
are immutable — supersede rather than rewrite.

See \`0000-record-architecture-decisions.md\` for why we do this, and
\`template.md\` for the shape of a new record.

## Index

<!-- adr-index:start -->
- [0000. Record architecture decisions](0000-record-architecture-decisions.md) — accepted
<!-- adr-index:end -->
`;

/** `scaffold` — create the ADR directory, template, meta-ADR, and index. */
export class ScaffoldCommand {
	/** Create the directory and starter files if absent, and return the directory. Idempotent. */
	static scaffold(adrDir: string): string {
		Fs.mkdirSync(adrDir, { recursive: true });
		AdrStore.writeIfAbsent(Path.join(adrDir, 'template.md'), TEMPLATE_MD);
		AdrStore.writeIfAbsent(Path.join(adrDir, '0000-record-architecture-decisions.md'), META_ADR_MD);
		AdrStore.writeIfAbsent(Path.join(adrDir, 'README.md'), README_MD);
		return adrDir;
	}
}
