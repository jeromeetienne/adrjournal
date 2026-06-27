import Fs from 'node:fs';
import Path from 'node:path';

/** Outcome of copying a single skill file into the agent folder. */
export type InstalledFile = {
	name: string;
	action: 'created' | 'updated';
	destination: string;
};

/** Summary returned by {@link InstallCommand.install}. */
export type InstallResult = {
	destinationDir: string;
	files: InstalledFile[];
};

/** `install` — copy the bundled adrify skill into a Claude Code agent folder. */
export class InstallCommand {
	/**
	 * Copy every bundled skill file into `<agentFolder>/skills/adrify/`.
	 * @param agentFolder Target `.claude` directory (project- or user-level).
	 * @returns The destination directory and the per-file outcome.
	 */
	static async install(agentFolder: string): Promise<InstallResult> {
		const sourceDir = Path.join(import.meta.dirname, '..', '..', 'dotclaude_folder', 'skills', 'adrify');
		if (Fs.existsSync(sourceDir) === false) {
			throw new Error(`bundled skill not found at ${sourceDir}`);
		}
		const destinationDir = Path.join(Path.resolve(agentFolder), 'skills', 'adrify');
		const files: InstalledFile[] = [];
		for (const name of InstallCommand.listFiles(sourceDir)) {
			const destination = Path.join(destinationDir, name);
			const exists = Fs.existsSync(destination);
			Fs.mkdirSync(Path.dirname(destination), { recursive: true });
			Fs.copyFileSync(Path.join(sourceDir, name), destination);
			files.push({ name, action: exists === true ? 'updated' : 'created', destination });
		}
		return { destinationDir, files };
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
