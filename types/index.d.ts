export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type PlanItem = { id: string; text: string; activeText: string; status: StepStatus }
export type Status = 'idle' | 'working' | 'waiting' | 'finished'

declare module 'claude-code' {
  interface PluginState {
    'clean-view': { plan: PlanItem[]; status: Status; action: string | null; isOn: boolean }
  }
}
