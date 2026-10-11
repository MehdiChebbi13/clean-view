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

const ACTIONS: Record<string, string> = {
  Bash: 'Running a command', PowerShell: 'Running a command',
  Read: 'Reading files', Glob: 'Reading files', Grep: 'Reading files',
  Edit: 'Editing files', Write: 'Editing files', NotebookEdit: 'Editing files',
  WebSearch: 'Searching the web', WebFetch: 'Searching the web',
  Agent: 'Working on a subtask',
}

export const actionLabel = (tool: string) => ACTIONS[tool] ?? `Using ${tool.split('__').pop()}` // mcp__server__tool -> tool
