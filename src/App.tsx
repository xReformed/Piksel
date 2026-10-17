const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator
const isCrossOriginIsolated = typeof window !== 'undefined' && window.crossOriginIsolated

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-6 py-2">
      <span className="text-slate-300">{label}</span>
      <span
        className={`rounded-full px-3 py-0.5 text-sm font-medium ${
          ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
        }`}
      >
        {ok ? 'Available' : 'Unavailable'}
      </span>
    </li>
  )
}

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight">OpenScale</h1>
        <p className="mt-1 text-slate-400">Browser-based AI image upscaler</p>
        <ul className="mt-6 divide-y divide-slate-800">
          <StatusRow label="WebGPU (navigator.gpu)" ok={hasWebGPU} />
          <StatusRow label="Cross-origin isolated" ok={isCrossOriginIsolated} />
        </ul>
      </div>
    </main>
  )
}

export default App
