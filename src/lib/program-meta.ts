// Purely cosmetic per-programme accent (color + icon), shared by every
// page that renders a programme card (homepage, /programs, /payment).
// Pricing/duration/description always come from the `programs` table —
// this map only controls presentation, and any slug not listed here
// falls back to DEFAULT_PROGRAM_META, so a new DB row renders
// correctly with zero code changes.
export const PROGRAM_META: Record<string, { color: string; colorRgb: string; icon: string }> = {
  'cloud-launchpad':  { color: '#00d4ff', colorRgb: '0,212,255',  icon: '☁️' },
  'cloud-architect':  { color: '#7c3aed', colorRgb: '124,58,237', icon: '🏗️' },
  'data-launchpad':   { color: '#22c55e', colorRgb: '34,197,94',  icon: '📊' },
  'data-architect':   { color: '#16a34a', colorRgb: '22,163,74',  icon: '🗄️' },
  'dev-launchpad':    { color: '#f59e0b', colorRgb: '245,158,11', icon: '💻' },
  'ai-dev-architect': { color: '#ec4899', colorRgb: '236,72,153', icon: '🤖' },
  'dsa-mastery':      { color: '#3b82f6', colorRgb: '59,130,246', icon: '🧮' },
}
export const DEFAULT_PROGRAM_META = { color: '#00d4ff', colorRgb: '0,212,255', icon: '📘' }
