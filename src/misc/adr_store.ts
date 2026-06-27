import Fs from 'node:fs';

/** Markers delimiting the generated index block inside the README. */
const INDEX_START = '<!-- adr-index:start -->';
const INDEX_END = '<!-- adr-index:end -->';

/**
 * Primitive mechanics shared by the ADR subcommands: slugging titles, numbering
 * records, listing the record files, and parsing or rewriting their heading,
 * status, and index block. The command classes orchestrate these primitives.
 */
export class AdrStore {
	/** Turn a title into a kebab-case slug (`Use SQLite!` → `use-sqlite`). */
	static slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+/, '')
			.replace(/-+$/, '');
	}

	/**
	 * Slug for `title`, or throw `title required` when it has no usable
	 * characters. Catches empty (`''`) and symbol-only (`'!!!'`) titles, both of
	 * which slug to an empty string and would otherwise yield a malformed
	 * `NNNN-.md` record.
	 */
	static requireSlug(title: string): string {
		const slug = AdrStore.slugify(title);
		if (slug === '') {
			throw new Error('title required');
		}
		return slug;
	}

	/** Basenames of the `NNNN-*.md` records in `adrDir`, sorted ascending. */
	static recordFiles(adrDir: string): string[] {
		if (Fs.existsSync(adrDir) === false) {
			return [];
		}
		return Fs.readdirSync(adrDir)
			.filter((name) => /^[0-9]{4}-.*\.md$/.test(name))
			.sort();
	}

	/** The next four-digit, zero-padded record number for `adrDir`. */
	static nextNumber(adrDir: string): string {
		let max = 0;
		for (const name of AdrStore.recordFiles(adrDir)) {
			const value = Number.parseInt(name.slice(0, 4), 10);
			if (Number.isNaN(value) === false && value > max) {
				max = value;
			}
		}
		return String(max + 1).padStart(4, '0');
	}

	/** First-line heading of a record, less its leading `#`; `fallback` when absent. */
	static recordTitle(content: string, fallback: string): string {
		const firstLine = content.split('\n', 1)[0] ?? '';
		if (/^#/.test(firstLine) === false) {
			return fallback;
		}
		const title = firstLine.replace(/^#[ \t]*/, '');
		return title === '' ? fallback : title;
	}

	/** The `Status:` value of a record; `?` when none is present. */
	static recordStatus(content: string): string {
		for (const line of content.split('\n')) {
			const match = line.match(/^-[ \t]*Status:[ \t]*(.*)$/);
			if (match !== null) {
				return match[1];
			}
		}
		return '?';
	}

	/** Replace the lines between the index markers in `readme` with `entries`. */
	static replaceIndexBlock(readme: string, entries: string[]): string {
		const output: string[] = [];
		let inside = false;
		for (const line of readme.split('\n')) {
			if (line.includes(INDEX_START) === true) {
				output.push(line, ...entries);
				inside = true;
				continue;
			}
			if (line.includes(INDEX_END) === true) {
				inside = false;
			}
			if (inside === false) {
				output.push(line);
			}
		}
		return output.join('\n');
	}

	/** Write `content` to `filePath` only when the file does not already exist. */
	static writeIfAbsent(filePath: string, content: string): void {
		if (Fs.existsSync(filePath) === false) {
			Fs.writeFileSync(filePath, content);
		}
	}
}
