import Fs from 'node:fs';
import Path from 'node:path';
import { AdrStore } from '../misc/adr_store.js';

/** `create` — create the next record from the template and print its path. */
export class CreateCommand {
	/** Create the next record for `title` from the template and return its path. */
	static create(title: string, adrDir: string): string {
		const slug = AdrStore.requireSlug(title);
		Fs.mkdirSync(adrDir, { recursive: true });
		const number = AdrStore.nextNumber(adrDir);
		const filePath = Path.join(adrDir, `${number}-${slug}.md`);
		const templatePath = Path.join(adrDir, 'template.md');
		if (Fs.existsSync(templatePath) === true) {
			const template = Fs.readFileSync(templatePath, 'utf-8');
			const body = template.replace(/^# NNNN\. .*/m, () => `# ${number}. ${title}`);
			Fs.writeFileSync(filePath, body);
		} else {
			Fs.writeFileSync(filePath, `# ${number}. ${title}\n\n- Status: proposed\n- Date: \n\n## Context\n\n## Decision\n\n## Consequences\n`);
		}
		return filePath;
	}
}
