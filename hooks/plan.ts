import type { PlanItem, StepStatus } from '../types'

type Todo = { content: string; status: StepStatus; activeForm?: string }
type TaskChange = { taskId: string; status?: StepStatus | 'deleted'; subject?: string; activeForm?: string }

// TodoWrite always sends the whole list: it replaces the plan.
export const fromTodoWrite = (todos: readonly Todo[]): PlanItem[] =>
  todos.map((t, i) => ({ id: `todo-${i}`, text: t.content, activeText: t.activeForm || t.content, status: t.status }))

export const addTask = (plan: PlanItem[], id: string, subject: string, activeForm?: string): PlanItem[] => [
  ...plan.filter(p => p.id !== id),
  { id, text: subject, activeText: activeForm || subject, status: 'pending' },
]

export function updateTask(plan: PlanItem[], change: TaskChange): PlanItem[] {
  const { status } = change
  if (status === 'deleted') return plan.filter(p => p.id !== change.taskId)
  return plan.map(p => {
    if (p.id !== change.taskId) return p
    const text = change.subject ?? p.text
    // an active text that only mirrored the subject follows a renamed subject
    const activeText = change.activeForm ?? (p.activeText === p.text ? text : p.activeText)
    return { ...p, text, activeText, status: status ?? p.status }
  })
}

export function progress(plan: PlanItem[]) {
  const done = plan.filter(p => p.status === 'completed').length
  const total = plan.length
  return { done, total, left: total - done, percent: total ? Math.round((done / total) * 100) : 0 }
}

export const currentIndex = (plan: PlanItem[]) => plan.findIndex(p => p.status === 'in_progress')

export const isAllDone = (plan: PlanItem[]) => plan.length > 0 && plan.every(p => p.status === 'completed')

export function bar(percent: number, width = 10) {
  const filled = Math.round((percent / 100) * width)
  return '▓'.repeat(filled) + '░'.repeat(width - filled)
}

// Which slice of a long list fits in `size` rows, centred on `focus`.
export function windowAround(length: number, focus: number, size: number) {
  if (length <= size) return { start: 0, end: length }
  const start = Math.min(Math.max(0, focus - Math.floor(size / 2)), length - size)
  return { start, end: start + size }
}

export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export function stepLabel(plan: PlanItem[], i: number, isWaiting: boolean) {
  const item = plan[i]!
  if (item.status === 'completed') return 'Done'
  if (item.status === 'in_progress') return isWaiting ? 'Waiting' : 'Working'
  return i === plan.findIndex(p => p.status === 'pending') ? 'Next' : 'Up next'
}

// --- bar colours: one 0xRRGGBB per cell ---------------------------------------
export const EMPTY = 0x3a3a3a

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const

export function mix(a: number, b: number, t: number) {
  const [ar, ag, ab] = channels(a)
  const [br, bg, bb] = channels(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return (m(ar, br) << 16) | (m(ag, bg) << 8) | m(ab, bb)
}

// The filled part is a gradient from `from` to `to`, the rest grey.
export function barColors(width: number, fill: number, from: number, to: number): number[] {
  const lit = Math.round(Math.min(1, Math.max(0, fill)) * width)
  return Array.from({ length: width }, (_, i) => (i < lit ? mix(from, to, width > 1 ? i / (width - 1) : 1) : EMPTY))
}

// A lit head with a fading tail that sweeps across the bar, one cell per tick.
export function shimmerColors(width: number, tick: number, color: number, tail = 5): number[] {
  const head = tick % (width + tail)
  return Array.from({ length: width }, (_, i) => {
    const d = head - i
    return d >= 0 && d < tail ? mix(EMPTY, color, 1 - d / tail) : EMPTY
  })
}

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

// Terminal: a Raster row of `▆` cells, packed as the Raster element wants them.
export function rasterCells(colors: number[], glyph = 0x2586) {
  const words = new Uint32Array(colors.length * 3)
  colors.forEach((c, i) => words.set([glyph, c, 0x01000000], i * 3)) // 0x01000000 = default background
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
}

// Desktop: the same cells as one rounded SVG strip.
export function svgBar(colors: number[], cell = 8, height = 8) {
  const w = colors.length * cell
  const rects = colors.map((c, i) => `<rect x="${i * cell}" width="${cell}" height="${height}" fill="${hex(c)}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}">`
    + `<clipPath id="r"><rect width="${w}" height="${height}" rx="${height / 2}"/></clipPath>`
    + `<g clip-path="url(#r)">${rects}</g></svg>`
}

const ACTIONS: Record<string, string> = {
  Bash: 'Running a command', PowerShell: 'Running a command',
  Read: 'Reading files', Glob: 'Reading files', Grep: 'Reading files',
  Edit: 'Editing files', Write: 'Editing files', NotebookEdit: 'Editing files',
  WebSearch: 'Searching the web', WebFetch: 'Searching the web',
  Agent: 'Working on a subtask',
}

export const actionLabel = (tool: string) => ACTIONS[tool] ?? `Using ${tool.split('__').pop()}` // mcp__server__tool -> tool
