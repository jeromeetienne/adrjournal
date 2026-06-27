import Fs from 'node:fs';
import Path from 'node:path';
import Os from 'node:os';
import ChildProcess from 'node:child_process';
import { z } from 'zod';

/** Stop-hook payload read from stdin; only these flat fields are used. */
const HookInputSchema = z
	.object({
		session_id: z.string().optional(),
		cwd: z.string().optional(),
	})
	.passthrough();

/** Parsed Stop-hook payload. */
export type HookInput = z.infer<typeof HookInputSchema>;

/** Directory names that each hold one package in a monorepo. */
const MONOREPO_CONTAINERS = new Set(['packages', 'apps', 'services', 'crates', 'modules']);

/** package.json blocks whose keys are dependency names. */
const DEPENDENCY_BLOCKS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** Infrastructure / schema / boundary files that usually encode a decision. */
const BOUNDARY_PATTERN = /(^|\/)(dockerfile|docker-compose\.ya?ml|.*\.tf|.*\.proto)$|(^|\/)(migrations|schema)(\/|$)/i;

/**
 * Stop-hook companion to the adrify skill. When a session produces a "decision
 * signal" — a new dependency, a new top-level area, or an infrastructure/schema
 * file — it prints a gentle, non-blocking reminder to record an ADR. It fires at
 * most once per session and stays silent when an ADR was already touched.
 */
export class NudgeCommand {
	/** Read the hook payload from stdin and evaluate the nudge; never throws. */
	static async nudge(): Promise<void> {
		try {
			const raw = await NudgeCommand.readStdin();
			let input: HookInput = {};
			try {
				input = HookInputSchema.parse(JSON.parse(raw));
			} catch {
				input = {};
			}
			NudgeCommand.evaluate(input);
		} catch {
			// A Stop hook must never break the session; stay silent on any failure.
		}
	}

	/** Decide whether to nudge for this payload, printing the message when it fires. */
	static evaluate(input: HookInput): void {
		const cwd = input.cwd !== undefined && input.cwd !== '' ? input.cwd : process.cwd();
		const sessionId = input.session_id !== undefined && input.session_id !== '' ? input.session_id : 'nosession';
		const adrDir = process.env.ADR_DIR !== undefined && process.env.ADR_DIR !== '' ? process.env.ADR_DIR : 'docs/ADRs';
		const marker = Path.join(Os.tmpdir(), `claude-adrify-nudge-${sessionId}`);

		// Already nudged this session, not a git repo, or an ADR is already being touched.
		if (Fs.existsSync(marker) === true) {
			return;
		}
		if (NudgeCommand.isGitRepo(cwd) === false) {
			return;
		}
		if (NudgeCommand.git(['status', '--porcelain', '--', adrDir], cwd) !== '') {
			return;
		}

		const changed = NudgeCommand.changedPaths(cwd);
		if (changed.length === 0) {
			return;
		}

		const reason = NudgeCommand.decisionReason(cwd, changed);
		if (reason === null) {
			return;
		}

		Fs.writeFileSync(marker, '');
		const message = `This session looks like it made an architectural decision (${reason}). Consider running /adrify new to record it.`;
		process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
	}

	/**
	 * The reason this session looks like an architectural decision, or null.
	 *
	 * The three checks below are the SIGNALS — the part worth tuning per project.
	 * The defaults assume a Node/TypeScript stack; see references/reuse.md.
	 */
	static decisionReason(cwd: string, changed: string[]): string | null {
		// SIGNAL: a dependency name now present in a package.json that was not at HEAD.
		for (const relativePath of changed.filter((entry) => /package\.json$/.test(entry))) {
			const absolutePath = Path.join(cwd, relativePath);
			if (Fs.existsSync(absolutePath) === false) {
				continue;
			}
			const headDependencies = NudgeCommand.dependenciesOf(NudgeCommand.git(['show', `HEAD:${relativePath}`], cwd));
			const currentDependencies = NudgeCommand.dependenciesOf(Fs.readFileSync(absolutePath, 'utf-8'));
			const added = [...currentDependencies].filter((name) => headDependencies.has(name) === false);
			if (added.length > 0) {
				return 'a dependency was added';
			}
		}

		// SIGNAL: a brand-new top-level directory, or a new package under a monorepo container.
		const candidates = new Set<string>();
		for (const entry of changed) {
			const segments = entry.split('/');
			if (segments.length > 1) {
				candidates.add(segments[0]);
			}
			if (segments.length > 2 && MONOREPO_CONTAINERS.has(segments[0]) === true) {
				candidates.add(`${segments[0]}/${segments[1]}`);
			}
		}
		for (const candidate of [...candidates].sort()) {
			const inHead = NudgeCommand.git(['ls-tree', 'HEAD', '--', candidate], cwd);
			const status = NudgeCommand.git(['status', '--porcelain', '--', candidate], cwd);
			if (inHead === '' && status !== '') {
				return `a new package or top-level area was added (${candidate})`;
			}
		}

		// SIGNAL: an infrastructure, schema, or boundary file changed.
		if (changed.some((entry) => BOUNDARY_PATTERN.test(entry) === true)) {
			return 'an infrastructure or schema/boundary file changed';
		}

		return null;
	}

	/** Tracked-and-untracked paths changed since HEAD, sorted and de-duplicated. */
	static changedPaths(cwd: string): string[] {
		const tracked = NudgeCommand.git(['diff', '--name-only', 'HEAD'], cwd);
		const untracked = NudgeCommand.git(['ls-files', '--others', '--exclude-standard'], cwd);
		const paths = `${tracked}\n${untracked}`
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line !== '');
		return [...new Set(paths)].sort();
	}

	/** Dependency names declared across every *Dependencies block of a package.json. */
	static dependenciesOf(packageJsonText: string): Set<string> {
		const names = new Set<string>();
		let parsed: unknown;
		try {
			parsed = JSON.parse(packageJsonText);
		} catch {
			return names;
		}
		if (typeof parsed !== 'object' || parsed === null) {
			return names;
		}
		const record = parsed as Record<string, unknown>;
		for (const block of DEPENDENCY_BLOCKS) {
			const value = record[block];
			if (typeof value === 'object' && value !== null) {
				for (const name of Object.keys(value)) {
					names.add(name);
				}
			}
		}
		return names;
	}

	/** Run `git` in `cwd`, returning its stdout, or '' when the command fails. */
	static git(args: string[], cwd: string): string {
		try {
			return ChildProcess.execFileSync('git', args, {
				cwd,
				encoding: 'utf-8',
				stdio: ['ignore', 'pipe', 'ignore'],
				maxBuffer: 32 * 1024 * 1024,
			});
		} catch {
			return '';
		}
	}

	/** Whether `cwd` is inside a git working tree. */
	static isGitRepo(cwd: string): boolean {
		try {
			ChildProcess.execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	}

	/** Read all of stdin as UTF-8 text. */
	static async readStdin(): Promise<string> {
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) {
			chunks.push(Buffer.isBuffer(chunk) === true ? chunk : Buffer.from(chunk));
		}
		return Buffer.concat(chunks).toString('utf-8');
	}
}
