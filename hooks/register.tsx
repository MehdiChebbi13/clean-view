import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Status } from '../types'
import { actionLabel, addTask, bar, currentIndex, fromTodoWrite, isAllDone, progress, updateTask, windowAround } from './plan'

const plan = atom({ plugin: 'clean-view', key: 'plan' } as const, [])
const status = atom({ plugin: 'clean-view', key: 'status' } as const, 'idle')
const action = atom({ plugin: 'clean-view', key: 'action' } as const, null)
const isOn = atom({ plugin: 'clean-view', key: 'isOn' } as const, true)

const setStatus = ($: EngineInterface, s: Status) => update($, status, () => s)

// Bookkeeping must never delay or break what Claude is doing.
const quietly = (work: Promise<unknown>) => void work.catch(() => {})

const HEADLINE: Record<Status, string> = {
  idle: '○ Idle',
  working: '● Working',
  waiting: '◆ Waiting for your input',
  finished: '✓ Finished',
}
const COLOR = { idle: 'subtle', working: 'claude', waiting: 'permission', finished: 'success' } as const
const ICON = { completed: '✓', in_progress: '▶', pending: '○' } as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'clean-view', description: 'Toggle Clean View (hide tool calls, show plan and progress)' })
    if ((await $.store.get('isOn')) === false) await update($, isOn, () => false)
    return next(e)
  })

  on('command.run', { command: 'clean-view' }, async $ => {
    const next = !(await read($, isOn))
    await update($, isOn, () => next)
    await $.store.set('isOn', next)
    return { text: `Clean View ${next ? 'on: tool calls hidden' : 'off: full transcript'}.` }
  })

  on('prompt.submit', ($, e, next) => {
    quietly(Promise.all([
      setStatus($, 'working'),
      update($, action, () => null),
      update($, plan, p => (isAllDone(p) ? [] : p)), // a finished plan makes room for the next one
    ]))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e) // a subagent's own list must not replace the main plan

    if (e.tool === 'TodoWrite') {
      quietly(update($, plan, () => fromTodoWrite(e.todos)))
      return next(e)
    }
    if (e.tool === 'TaskUpdate') {
      quietly(update($, plan, p => updateTask(p, e)))
      return next(e)
    }
    if (e.tool === 'TaskCreate') {
      const ran = await next(e)
      const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
      if (id) quietly(update($, plan, p => addTask(p, id, e.subject, e.activeForm)))
      return ran
    }

    const asksPerson = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
    quietly(asksPerson ? setStatus($, 'waiting') : update($, action, () => actionLabel(e.tool)))
    const ran = await next(e)
    // after a question or an approval dialog, Claude is working again
    quietly(update($, status, s => (s === 'waiting' ? 'working' : s)))
    return ran
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id && !e.agentId) quietly(setStatus($, 'waiting'))
    return verdict
  })

  on('turn.complete', ($, e, next) => {
    quietly(Promise.all([setStatus($, 'finished'), update($, action, () => null)]))
    return next(e)
  })

  // --- hide the noisy transcript rows ---------------------------------------
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    if (e.props.isErrored || e.props.isInterrupted) {
      return <Text dimColor>✗ {e.props.tool} {e.props.isInterrupted ? 'interrupted' : 'failed'}</Text>
    }
    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, isOn)) || e.props.isExpanded) return next(e) // verbose / ctrl+o still shows all
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // --- the clean view, above the prompt -------------------------------------
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isOn))) return next(e)
    const items = await read($, plan)
    const s = await read($, status)
    const act = await read($, action)
    if (s === 'idle' && items.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const { done, total, left, percent } = progress(items)
    const cur = currentIndex(items)
    const step = cur >= 0 ? cur + 1 : Math.min(done + 1, total)
    const summary = total === 0 ? '' : s === 'finished' ? `  ·  ${done} of ${total} done` : `  ·  step ${step} of ${total}  ·  ${done} done, ${left} left`
    const { start, end } = windowAround(items.length, cur >= 0 ? cur : done, Math.max(1, e.props.maxRows - 3))

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold color={COLOR[s]}>{HEADLINE[s]}</Text>
          <Text dimColor>{summary}</Text>
          {total > 0 && <Text>{`  ${bar(percent)} ${percent}%`}</Text>}
        </Text>
        {total === 0 && act && s !== 'finished' && <Text>▶ {act}</Text>}
        {start > 0 && <Text dimColor>  … {String(start)} more above</Text>}
        {items.slice(start, end).map(item => (
          <Text bold={item.status === 'in_progress'} dimColor={item.status === 'completed'}>
            {ICON[item.status]} {item.status === 'in_progress' ? item.activeText : item.text}
          </Text>
        ))}
        {end < items.length && <Text dimColor>  … {String(items.length - end)} more</Text>}
      </Box>
    )
  })
}
