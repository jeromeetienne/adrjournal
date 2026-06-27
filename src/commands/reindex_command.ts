import Fs from 'node:fs';
import Path from 'node:path';
import { AdrStore } from '../adr_store.js';

/** `reindex` — rebuild the index block in README.md from the record files. */
export class ReindexCommand {
	/** Rebuild the index block in `adrDir/README.md` and return the README path. */
	static reindex(adrDir: string): string {
		const readmePath = Path.join(adrDir, 'README.md');
		if (Fs.existsSync(readmePath) === false) {
			throw new Error(`no README.md in ${adrDir}`);
		}
		const entries = AdrStore.recordFiles(adrDir).map((name) => {
			const content = Fs.readFileSync(Path.join(adrDir, name), 'utf-8');
			return `- [${AdrStore.recordTitle(content, name)}](${name}) — ${AdrStore.recordStatus(content)}`;
		});
		const rebuilt = AdrStore.replaceIndexBlock(Fs.readFileSync(readmePath, 'utf-8'), entries);
		Fs.writeFileSync(readmePath, rebuilt);
		return readmePath;
	}
}
