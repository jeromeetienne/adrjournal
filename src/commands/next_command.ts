import Path from 'node:path';
import { AdrStore } from '../adr_store.js';

/** `next` — print the path of the next record without creating it. */
export class NextCommand {
	/** Path of the next record for `title`, WITHOUT creating it. */
	static next(title: string, adrDir: string): string {
		return Path.join(adrDir, `${AdrStore.nextNumber(adrDir)}-${AdrStore.slugify(title)}.md`);
	}
}
