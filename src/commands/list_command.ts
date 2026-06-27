import Path from 'node:path';
import { AdrStore } from '../adr_store.js';

/** `list` — list existing records, one path per line. */
export class ListCommand {
	/** Full paths of existing records, one suitable for printing per line. */
	static list(adrDir: string): string[] {
		return AdrStore.recordFiles(adrDir).map((name) => Path.join(adrDir, name));
	}
}
