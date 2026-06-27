// Client for the standalone bookshelf service. The dashboard's "Currently reading" widget
// fetches the live bookshelf API at request time (callers use `dynamic = 'force-dynamic'`)
// rather than reading the store file in-process — bookshelf is its own service now.
//
// Base URL is env-configurable (the systemd unit sets BOOKSHELF_API); defaults to the
// localhost port the bookshelf service binds to. The bookshelf app bakes basePath '/bookshelf',
// so its API lives under /bookshelf/api/... — same path whether reached directly or via Caddy.
const BOOKSHELF_API = process.env.BOOKSHELF_API ?? 'http://127.0.0.1:3010';

// A trimmed view of a bookshelf record — just what the dashboard widget renders.
export type ReadingBook = {
  id: string;
  title: string;
  author: string;
  // True when the book has cover art to serve via the bookshelf cover endpoint.
  hasCover: boolean;
};

type RawBook = {
  id?: string;
  title?: string;
  author?: string;
  coverId?: number | null;
  coverUrl?: string | null;
  status?: string;
  startedAt?: string | null;
};

// Same-origin URL for a book's cached cover (Caddy routes /bookshelf/* to the bookshelf
// service, which serves cover bytes from its local cache). Only valid for books with cover art.
export function coverHref(book: ReadingBook): string {
  return `/bookshelf/api/cover/${book.id}/`;
}

// Fetch currently-reading books from the bookshelf service, most-recently-started first.
// Degrades to [] on any failure (service down, bad response) so the dashboard never crashes
// when bookshelf is unavailable — the widget simply renders nothing.
export async function readCurrentlyReading(): Promise<ReadingBook[]> {
  let parsed: RawBook[];
  try {
    const res = await fetch(`${BOOKSHELF_API}/bookshelf/api/books/?status=reading`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { books?: RawBook[] } | RawBook[];
    // The service returns { books: [...] }; tolerate a bare array too.
    parsed = Array.isArray(json) ? json : Array.isArray(json.books) ? json.books : [];
  } catch {
    return [];
  }

  return parsed
    .filter((b) => b.status === 'reading' && b.id && b.title)
    .sort((a, b) => ((a.startedAt ?? '') < (b.startedAt ?? '') ? 1 : -1))
    .map((b) => ({
      id: b.id as string,
      title: b.title as string,
      author: b.author ?? '',
      hasCover: Boolean(b.coverId || b.coverUrl),
    }));
}
