import Fs from 'node:fs';
import Path from 'node:path';

/** The Stop-hook command registered in the target's settings.json. */
const NUDGE_COMMAND = 'npx adrjournal nudge';

/** Outcome of copying a single agent file into the destination folder. */
export type InstalledFile = {
	name: string;
	action: 'created' | 'updated';
	destination: string;
};

/** Outcome of registering the Stop hook in the target's settings.json. */
export type HookOutcome = {
	status: 'added' | 'present' | 'skipped';
	settingsPath?: string;
};

/** Summary returned by {@link InstallCommand.install}. */
export type InstallResult = {
	destinationDir: string;
	files: InstalledFile[];
	hook: HookOutcome;
};

/** `install` — copy the bundled agent files into a Claude Code agent folder. */
export class InstallCommand {
	/**
	 * Copy every bundled agent file into `agentFolder` (the agent directory, e.g.
	 * `.claude`), preserving the relative layout, to set the skill up in a target.
	 * When the destination is itself named `.claude`, also register the
	 * `npx adrjournal nudge` Stop hook in its `settings.json` (idempotent,
	 * non-destructive); otherwise the hook step is skipped, since `settings.json`
	 * is a `.claude` concept.
	 * @param agentFolder Destination agent folder; the caller defaults it to `.`.
	 * @returns The destination directory, the per-file outcome, and the hook outcome.
	 */
	static async install(agentFolder: string): Promise<InstallResult> {
		const sourceDir = Path.join(import.meta.dirname, '..', '..', 'dotclaude_folder');
		if (Fs.existsSync(sourceDir) === false) {
			throw new Error(`bundled agent files not found at ${sourceDir}`);
		}
		const destinationDir = Path.resolve(agentFolder);
		const files: InstalledFile[] = [];
		for (const name of InstallCommand.listFiles(sourceDir)) {
			const destination = Path.join(destinationDir, name);
			const exists = Fs.existsSync(destination);
			Fs.mkdirSync(Path.dirname(destination), { recursive: true });
			Fs.copyFileSync(Path.join(sourceDir, name), destination);
			files.push({ name, action: exists === true ? 'updated' : 'created', destination });
		}
		const hook: HookOutcome =
			Path.basename(destinationDir) === '.claude'
				? InstallCommand.registerHook(destinationDir)
				: { status: 'skipped' };
		return { destinationDir, files, hook };
	}

	/**
	 * Merge the `npx adrjournal nudge` Stop hook into `claudeDir/settings.json`,
	 * creating the file when absent and preserving any existing settings and hooks.
	 * No-op when the hook is already registered.
	 */
	static registerHook(claudeDir: string): HookOutcome {
		const settingsPath = Path.join(claudeDir, 'settings.json');
		let settings: Record<string, unknown> = {};
		if (Fs.existsSync(settingsPath) === true) {
			try {
				const parsed: unknown = JSON.parse(Fs.readFileSync(settingsPath, 'utf-8'));
				settings = InstallCommand.asRecord(parsed);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`invalid JSON in ${settingsPath}: ${message}`);
			}
		}
		const hooks = InstallCommand.asRecord(settings.hooks);
		const stop = InstallCommand.asArray(hooks.Stop);
		if (InstallCommand.hasNudgeHook(stop) === true) {
			return { status: 'present', settingsPath };
		}
		stop.push({ matcher: '*', hooks: [{ type: 'command', command: NUDGE_COMMAND }] });
		hooks.Stop = stop;
		settings.hooks = hooks;
		Fs.mkdirSync(claudeDir, { recursive: true });
		Fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
		return { status: 'added', settingsPath };
	}

	/** Whether any entry in a `Stop` hook array already runs `adrjournal nudge`. */
	static hasNudgeHook(stop: unknown[]): boolean {
		for (const entry of stop) {
			for (const hook of InstallCommand.asArray(InstallCommand.asRecord(entry).hooks)) {
				const command = InstallCommand.asRecord(hook).command;
				if (typeof command === 'string' && command.includes('adrjournal nudge') === true) {
					return true;
				}
			}
		}
		return false;
	}

	/** `value` as a plain object, or `{}` when it is not one. */
	static asRecord(value: unknown): Record<string, unknown> {
		if (typeof value === 'object' && value !== null && Array.isArray(value) === false) {
			return value as Record<string, unknown>;
		}
		return {};
	}

	/** `value` as an array, or `[]` when it is not one. */
	static asArray(value: unknown): unknown[] {
		return Array.isArray(value) === true ? value : [];
	}

	/** Paths of every file under `dir`, relative to `dir`, recursively. */
	static listFiles(dir: string): string[] {
		const result: string[] = [];
		for (const entry of Fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory() === true) {
				for (const nested of InstallCommand.listFiles(Path.join(dir, entry.name))) {
					result.push(Path.join(entry.name, nested));
				}
			} else {
				result.push(entry.name);
			}
		}
		return result;
	}
}
