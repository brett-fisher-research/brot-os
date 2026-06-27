import { readExperiments } from '@/lib/registry';
import { SubPage } from '@/app/_components/SubPage';

// The platform sidebar links here (/experiments). Read the registry at request time
// so newly added experiments show without a rebuild.
export const dynamic = 'force-dynamic';

const TS_HOST = 'intel-nuc.mullet-ostrich.ts.net';

export default async function Experiments() {
  const experiments = await readExperiments();

  return (
    <SubPage title="🧪 Experiments" sub={TS_HOST}>
      <div className="section-head">
        <h2>Live</h2>
        <span className="count">{experiments.length}</span>
      </div>
      {experiments.length === 0 ? (
        <p className="empty">
          No experiments yet. Run <code>/new-experiment</code> from Claude Code.
        </p>
      ) : (
        <div className="grid">
          {experiments.map((exp) => {
            const meta = [exp.repo, exp.created?.slice(0, 10)].filter(Boolean).join(' · ');
            const inner = (
              <>
                <div className="card-top">
                  <span className="name">{exp.slug}</span>
                  <span className="badge badge-type">{exp.type}</span>
                </div>
                {meta && <span className="meta">{meta}</span>}
              </>
            );
            // Workers have no URL — render a non-clickable card.
            return exp.href ? (
              <a className="card" href={exp.href} key={exp.slug}>
                {inner}
              </a>
            ) : (
              <div className="card card-static" key={exp.slug}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </SubPage>
  );
}
