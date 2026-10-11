import { expect, test } from 'claude-code/testing'

import { actionLabel, addTask, bar, currentIndex, fromTodoWrite, isAllDone, progress, updateTask, windowAround } from '../hooks/plan'

const TODOS = [
  { content: 'Read the notebooks', status: 'completed' as const, activeForm: 'Reading the notebooks' },
  { content: 'Write chapter 3', status: 'in_progress' as const, activeForm: 'Writing chapter 3' },
  { content: 'Verify the code', status: 'pending' as const, activeForm: 'Verifying the code' },
]

test('TodoWrite replaces the plan; progress and current step follow it', () => {
  const plan = fromTodoWrite(TODOS)
  expect(plan.map(p => p.text)).toEqual(['Read the notebooks', 'Write chapter 3', 'Verify the code'])
  expect(progress(plan)).toEqual({ done: 1, total: 3, left: 2, percent: 33 })
  expect(currentIndex(plan)).toBe(1)
  expect(isAllDone(plan)).toBe(false)
  expect(bar(50, 10)).toBe('▓▓▓▓▓░░░░░')
})

test('TaskCreate / TaskUpdate build and edit the plan; deleted removes', () => {
  let plan = addTask([], '1', 'Split the data', 'Splitting the data')
  plan = addTask(plan, '2', 'Train the model')
  plan = updateTask(plan, { taskId: '1', status: 'completed' })
  plan = updateTask(plan, { taskId: '2', status: 'in_progress', subject: 'Train the MLP' })
  expect(plan.map(p => [p.text, p.activeText, p.status])).toEqual([
    ['Split the data', 'Splitting the data', 'completed'],
    ['Train the MLP', 'Train the MLP', 'in_progress'],
  ])
  expect(updateTask(plan, { taskId: '1', status: 'deleted' }).length).toBe(1)
})

test('long lists keep a window around the current step; actions are labelled', () => {
  expect(windowAround(3, 1, 5)).toEqual({ start: 0, end: 3 })
  expect(windowAround(20, 10, 5)).toEqual({ start: 8, end: 13 })
  expect(windowAround(20, 19, 5)).toEqual({ start: 15, end: 20 })
  expect(actionLabel('Bash')).toBe('Running a command')
  expect(actionLabel('mcp__github__create_issue')).toBe('Using create_issue')
})

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 11 }, view: {} },
}
const ROW = {
  component: 'ToolUse' as const,
  props: { tool_use_id: 't1', tool: 'Bash', input: { command: 'ls' }, isRunning: false, isErrored: false, isInterrupted: false },
}

test('the band shows the plan and the tool rows are hidden', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', () => ({ result: {} }) as never)

  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'clean-view', surface, ...BAND })
    expect(await band.find({ text: /step 2 of 3/ })).toBeDefined()
    expect(await band.find({ text: /Writing chapter 3/ })).toBeDefined()
    expect(await band.find({ text: /33%/ })).toBeDefined()
    await band.unmount()

    const row = await $.ui.mount({ plugin: 'clean-view', surface, ...ROW })
    expect(await row.find({ type: 'Text' })).toBeUndefined()
    await row.unmount()
  }
})
