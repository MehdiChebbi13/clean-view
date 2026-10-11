import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Status } from '../types'
import {
  actionLabel, addTask, barColors, currentIndex, duration, fromTodoWrite, isAllDone, progress,
  rasterCells, shimmerColors, stepLabel, svgBar, updateTask, windowAround,
} from './plan'

const plan = atom({ plugin: 'clean-view', key: 'plan' } as const, [])
const status = atom({ plugin: 'clean-view', key: 'status' } as const, 'idle')
const action = atom({ plugin: 'clean-view', key: 'action' } as const, null)
const isOn = atom({ plugin: 'clean-view', key: 'isOn' } as const, true)
const title = atom({ plugin: 'clean-view', key: 'title' } as const, '')
const startedAt = atom({ plugin: 'clean-view', key: 'startedAt' } as const, null)
const finishedAt = atom({ plugin: 'clean-view', key: 'finishedAt' } as const, null)
const tick = atom({ plugin: 'clean-view', key: 'tick' } as const, 0)

const setStatus = ($: EngineInterface, s: Status) => update($, status, () => s)

// Bookkeeping must never delay or break what Claude is doing.
const quietly = (work: Promise<unknown>) => void work.catch(() => {})

// --- look ---------------------------------------------------------------------
const WORK = [0xff8a3d, 0xff4fa3] as const // orange -> pink
const DONE = [0x16803c, 0x4ade80] as const // green gradient
const WAIT = 0xf59e0b // amber
const PINK = '#ff4fa3'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const TITLE = '#b4a7ff'
const MINI = 14 // cells of a step's bar
const HEADLINE: Record<Status, string> = { idle: 'Idle', working: 'Working', waiting: 'Waiting for your input', finished: 'Finished' }

// one ticker while Claude works: it drives the elapsed timer and the shimmer
let ticker: Timer | null = null

function startTicker($: EngineInterface) {
  ticker?.cancel()
  ticker = $.clock.every(500, () => quietly(update($, tick, n => n + 1)))
}

function stopTicker() {
  ticker?.cancel()
  ticker = null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'clean-view', description: 'Toggle Clean View (hide tool calls, show plan and progress)' })
    if ((await $.store.get('isOn')) === false) await update($, isOn, () => false)
    if ((await read($, status)) === 'working') startTicker($) // reloaded mid-turn
    return next(e)
  })

  on('command.run', { command: 'clean-view' }, async $ => {
    const next = !(await read($, isOn))
    await update($, isOn, () => next)
    await $.store.set('isOn', next)
    return { text: `Clean View ${next ? 'on: tool calls hidden' : 'off: full transcript'}.` }
  })

  on('prompt.submit', ($, e, next) => {
    startTicker($)
    quietly((async () => {
      const now = await $.clock.now()
      await Promise.all([
        setStatus($, 'working'),
        update($, action, () => null),
        update($, title, () => e.text.trim().split('\n')[0] ?? ''),
        update($, startedAt, () => now),
        update($, finishedAt, () => null),
        update($, plan, p => (isAllDone(p) ? [] : p)), // a finished plan makes room for the next one
      ])
    })())
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
    stopTicker()
    quietly((async () => {
      const now = await $.clock.now()
      await Promise.all([setStatus($, 'finished'), update($, action, () => null), update($, finishedAt, () => now)])
    })())
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
    if (s === 'idle' && items.length === 0) return next(e)

    const act = await read($, action)
    const heading = await read($, title)
    const frame = await read($, tick) // subscribes the band to the ticker
    const started = await read($, startedAt)
    const finished = await read($, finishedAt)
    const now = await $.clock.now()

    const { Box, Text } = $.ui.resolve(e)
    // terminal: a Raster of coloured cells; desktop: the same cells as an SVG strip
    const bar = (key: string, colors: number[]) => {
      if (e.surface === 'terminal') {
        const { Raster } = $.ui.resolve(e)
        return <Raster key={key} columns={colors.length} rows={1} cells={rasterCells(colors)} />
      }
      const { Svg } = $.ui.resolve(e)
      return <Svg source={svgBar(colors)} alt={key} width={colors.length * 8} height={8} />
    }

    const isDone = s === 'finished'
    const isWaiting = s === 'waiting'
    const accent = isDone ? GREEN : isWaiting ? AMBER : PINK
    const width = e.props.bodyColumns - (isDone ? 4 : 0) // the finished card's border and padding
    const { done, total, percent } = progress(items)
    const cur = currentIndex(items)
    const elapsed = started === null ? ''
      : isDone && finished !== null ? `took ${duration(finished - started)}`
      : duration(now - started)

    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexShrink={1}>
          {isDone
            ? <Text backgroundColor={GREEN} color="#0b0b0b" bold> ✓ All done </Text>
            : <Text color={accent} bold>{isWaiting ? '◆' : '✱'}</Text>}
          <Text color={TITLE} bold wrap="truncate-end"> {heading || HEADLINE[s]}</Text>
        </Box>
        <Box flexShrink={0}>
          {isWaiting && <Text color={AMBER} bold>Waiting for you  </Text>}
          <Text dimColor>{elapsed}</Text>
        </Box>
      </Box>
    )

    let overall = null
    if (total > 0) {
      const label = isDone ? `${done} of ${total} steps` : `Step ${cur >= 0 ? cur + 1 : Math.min(done + 1, total)} of ${total}`
      const labelWidth = Math.max(13, label.length + 1)
      const barWidth = Math.max(8, width - labelWidth - 6)
      const colors = isDone ? barColors(barWidth, 1, ...DONE)
        : isWaiting ? barColors(barWidth, percent / 100, WAIT, WAIT)
        : barColors(barWidth, percent / 100, ...WORK)
      overall = (
        <Box flexDirection="row">
          <Box width={labelWidth}><Text>{label}</Text></Box>
          {bar('bar-total', colors)}
          <Box width={6} justifyContent="flex-end"><Text color={accent} bold>{`${percent}%`}</Text></Box>
        </Box>
      )
    }

    const longest = Math.max(10, ...items.map(item => item.text.length + 1))
    const textWidth = Math.max(10, Math.min(longest, width - 2 - MINI - 10))
    const { start, end } = windowAround(items.length, cur >= 0 ? cur : done, Math.max(1, e.props.maxRows - (isDone ? 6 : 4)))

    const rows = items.slice(start, end).map((item, k) => {
      const i = start + k
      const label = stepLabel(items, i, isWaiting)
      const isCurrent = item.status === 'in_progress'
      const isPending = item.status === 'pending'
      const colors = item.status === 'completed' ? barColors(MINI, 1, ...DONE)
        : isCurrent ? (isWaiting ? barColors(MINI, 0.4, WAIT, WAIT) : shimmerColors(MINI, frame, WORK[1]))
        : barColors(MINI, 0, ...WORK)
      return (
        <Box flexDirection="row">
          <Box width={2}>
            <Text color={isCurrent ? accent : isPending ? undefined : GREEN} dimColor={isPending}>
              {isCurrent ? '●' : isPending ? '○' : '✓'}
            </Text>
          </Box>
          <Box width={textWidth}>
            <Text bold={isCurrent} dimColor={isPending} wrap="truncate-end">{item.text}</Text>
          </Box>
          {bar(`bar-${item.id}`, colors)}
          <Box marginLeft={2}>
            {isCurrent
              ? <Text color={accent} bold>{label}</Text>
              : <Text dimColor>{label}</Text>}
          </Box>
        </Box>
      )
    })

    return (
      <Box flexDirection="column" {...(isDone ? { borderStyle: 'round', borderColor: GREEN, paddingX: 1 } : {})}>
        {header}
        {overall}
        {total === 0 && act && !isDone && <Text dimColor>▶ {act}</Text>}
        {start > 0 && <Text dimColor>  … {String(start)} more above</Text>}
        {rows}
        {end < items.length && <Text dimColor>  … {String(items.length - end)} more</Text>}
      </Box>
    )
  })
}
