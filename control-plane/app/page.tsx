import { getControlPlaneState } from '@/lib/state';

const nav = ['Overview', 'Projects', 'Agents', 'Memory', 'Knowledge', 'Logs', 'Telemetry', 'Costs'];

export const dynamic = 'force-dynamic';

export default async function Home() {
  const state = await getControlPlaneState();
  const cards = [
    ['Campaigns', state.metrics.campaigns, 'Durable initiatives'],
    ['Active tasks', state.metrics.tasks, 'Natural language + /do'],
    ['Memory records', state.metrics.memory, 'Structured + Markdown'],
    ['Approvals', state.metrics.approvals, 'Human safety boundary'],
    ['Fleet files', state.metrics.fleet, 'Parallel execution'],
    ['Telemetry files', state.metrics.telemetry, 'Evidence and costs'],
  ];

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-5 py-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan">
            <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_16px_#b8f34a]" />
            The AI Engineering Operating System.
          </div>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">ForgeOS</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            One operational view across projects, specialist agents, memory, knowledge, approvals, telemetry, and model cost.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted">
          {state.project} · {new Date(state.generatedAt).toLocaleString()}
        </div>
      </header>

      <nav className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {nav.map((item, index) => (
          <button key={item} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${index === 0 ? 'bg-cyan text-ink' : 'border border-white/10 bg-white/5 text-muted'}`}>
            {item}
          </button>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([label, value, detail]) => (
          <article key={String(label)} className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-glow">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-white/10 bg-panel/80 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan">Execution</p>
              <h2 className="mt-2 text-2xl font-semibold">Recent engineering tasks</h2>
            </div>
            <span className="rounded-full bg-lime/10 px-3 py-1 text-xs text-lime">Crash recovery enabled</span>
          </div>
          <div className="mt-6 space-y-3">
            {state.tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm text-muted">
                No ForgeOS tasks yet. Run <code className="text-cyan">npm run os:plan -- &quot;your task&quot;</code>.
              </div>
            ) : state.tasks.slice(0, 8).map((task, index) => {
              const item = task as { id?: string; prompt?: string; status?: string; route?: string; roles?: string[] };
              return (
                <div key={item.id || index} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium">{item.prompt || 'Unnamed task'}</p>
                    <p className="mt-2 text-xs text-muted">{item.roles?.join(' · ') || 'Unassigned'} · {item.route}</p>
                  </div>
                  <span className="h-fit rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs text-cyan">{item.status || 'unknown'}</span>
                </div>
              );
            })}
          </div>
        </article>

        <div className="grid gap-6">
          <article className="rounded-3xl border border-white/10 bg-panel/80 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan">Team Mode</p>
            <h2 className="mt-2 text-2xl font-semibold">Specialist roster</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {state.team.map((role) => <span key={role} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm">{role}</span>)}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-panel/80 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan">Model Fabric</p>
            <h2 className="mt-2 text-2xl font-semibold">Provider readiness</h2>
            <div className="mt-5 space-y-3">
              {state.providers.map(([name, ready]) => (
                <div key={String(name)} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                  <span>{name}</span>
                  <span className={ready ? 'text-lime' : 'text-muted'}>{ready ? 'Ready' : 'Not configured'}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
