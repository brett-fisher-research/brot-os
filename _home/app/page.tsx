import { readCurrentlyReading, coverHref, type ReadingBook } from '@/lib/books';
import { Observability } from '@/app/_components/Observability';

// The personal daily dashboard — the first thing seen on every visit. Keep it focused
// on what matters most right now; this page evolves as priorities shift. See CLAUDE.md
// ("The home page (personal dashboard)") for the intent behind this surface.
export const dynamic = 'force-dynamic';

// Current focus — the single most important thing to ship right now.
const CURRENT_FOCUS = 'Ship a paid version of Durée';

// A tappable widget showing what's currently being read; the whole card links to the
// bookshelf, where the full library lives. Hidden entirely when nothing is in progress.
function CurrentlyReading({ books }: { books: ReadingBook[] }) {
  if (books.length === 0) return null;
  return (
    // Plain <a>, not next/link: /bookshelf/ is a separate app behind Caddy, not an
    // internal _home route — a <Link> would RSC-prefetch /bookshelf and 404.
    <a className="reading" href="/bookshelf/" aria-label="Currently reading — open bookshelf">
      <div className="reading-head">
        <span>
          <span aria-hidden="true">📚</span> Currently reading
        </span>
        <span className="reading-arrow" aria-hidden="true">
          →
        </span>
      </div>
      <div className="reading-strip">
        {books.map((book) => (
          <div className="reading-book" key={book.id}>
            <div className="reading-cover">
              {book.hasCover ? (
                // eslint-disable-next-line @next/next/no-img-element -- same-origin cached cover, no optimizer
                <img src={coverHref(book)} alt={book.title} loading="lazy" />
              ) : (
                <span className="reading-cover-fallback" aria-hidden="true">
                  📖
                </span>
              )}
            </div>
            <span className="reading-title">{book.title}</span>
          </div>
        ))}
      </div>
    </a>
  );
}

export default async function Home() {
  const reading = await readCurrentlyReading();

  return (
    <main>
      <h1>🏠 Home</h1>

      <section className="focus" aria-label="Current focus">
        <span className="focus-emoji" aria-hidden="true">
          🎯
        </span>
        <div className="focus-body">
          <span className="focus-label">Current focus</span>
          <p className="focus-text">{CURRENT_FOCUS}</p>
        </div>
      </section>

      <CurrentlyReading books={reading} />

      <Observability />
    </main>
  );
}
