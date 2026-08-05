import { Cloud, Network, BarChart3, Database, Code2, Bot, Binary, BookOpen, type LucideIcon } from 'lucide-react'

// Purely cosmetic per-programme accent (color + icon), shared by every
// page that renders a programme card (homepage, /programs, /payment).
// Pricing/duration/description always come from the `programs` table —
// this map only controls presentation, and any slug not listed here
// falls back to DEFAULT_PROGRAM_META, so a new DB row renders
// correctly with zero code changes.
export const PROGRAM_META: Record<string, { color: string; colorRgb: string; icon: LucideIcon }> = {
  'cloud-launchpad':  { color: '#6fa8b8', colorRgb: '111,168,184', icon: Cloud },
  'cloud-architect':  { color: '#8b6fb0', colorRgb: '139,111,176', icon: Network },
  'data-launchpad':   { color: '#5a9e74', colorRgb: '90,158,116',  icon: BarChart3 },
  'data-architect':   { color: '#457d5c', colorRgb: '69,125,92',   icon: Database },
  'dev-launchpad':    { color: '#c98a3b', colorRgb: '201,138,59',  icon: Code2 },
  'ai-dev-architect': { color: '#b0668c', colorRgb: '176,102,140', icon: Bot },
  'dsa-mastery':      { color: '#5e7fb0', colorRgb: '94,127,176',  icon: Binary },
}
export const DEFAULT_PROGRAM_META = { color: '#9a9a9a', colorRgb: '154,154,154', icon: BookOpen }
