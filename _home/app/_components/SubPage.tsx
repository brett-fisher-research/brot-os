import Link from 'next/link';

// The shared layout for every dashboard sub-page (experiments, ideas, and promoted
// experiments like bookshelf). It standardizes the two things every sub-page shares:
//   1. a "← Home" top-nav link (the platform-back convention — styled by the shared
//      /platform-chrome.css, and the FIRST child of <main> so the hamburger safe-area
//      rule `main > :first-child` indents it past the floating launcher), and
//   2. a page title row (the <h1>, with an optional right-aligned `actions` slot).
//
// `backHref`/`backLabel` default to Home but can point elsewhere for nested pages
// (e.g. a book detail page links back to the bookshelf index, not all the way Home).
export function SubPage({
  title,
  sub,
  actions,
  backHref = '/',
  backLabel = '← Home',
  children,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main>
      <Link className="platform-back" href={backHref}>
        {backLabel}
      </Link>
      {(title || actions) && (
        <div className="page-title-row">
          {title ? <h1>{title}</h1> : <span />}
          {actions}
        </div>
      )}
      {sub && <p className="sub">{sub}</p>}
      {children}
    </main>
  );
}
