import Fs from 'node:fs';
import Path from 'node:path';

/** Outcome of copying a single agent file into the destination folder. */
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

/** `install` — copy the bundled agent files into a Claude Code agent folder. */
export class InstallCommand {
	/**
	 * Copy every bundled agent file into `agentFolder` (the agent directory, e.g.
	 * `.claude`), preserving the relative layout, to set the skill up in a target.
	 * @param agentFolder Destination agent folder; the caller defaults it to `.`.
	 * @returns The destination directory and the per-file outcome.
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
