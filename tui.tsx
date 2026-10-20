import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import {
  buildSnapshot,
  diffFreeModels,
  formatBaseline,
  formatReport,
  initialState,
  localDay,
  type ProviderInput,
} from "./logic"

type Later = (task: () => void) => void

// setup can run for several locations in one TUI process. Keep one report and
// one baseline notice per process so the modal cannot appear more than once.
let baselineShown = false
let shownDay = ""

async function report(context: Context, later: Later): Promise<void> {
  const location = context.location ?? context.data.location.default()
  const [state, update] = context.storage.store("free-models", { initial: initialState })

  await Promise.all([
    context.data.location.model.sync(location),
    context.data.location.provider.sync(location),
  ])

  const models = context.data.location.model.list(location) ?? []
  if (models.length === 0) return

  const providers = context.data.location.provider.list(location) ?? []
  const providerInput: ProviderInput[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
  }))

  const now = new Date()
  const today = localDay(now)
  const previous = state.models ?? {}
  const lastStartAt = typeof state.lastStartAt === "number" ? state.lastStartAt : 0
  const lastReportDay = typeof state.lastReportDay === "string" ? state.lastReportDay : ""
  const firstRun = lastStartAt === 0
  const reportDay = lastReportDay !== today
  const snapshot = buildSnapshot(models)
  const freeCount = Object.values(snapshot).filter((model) => model.free).length

  // The snapshot advances on every start, so the next report is measured from
  // the most recent start, not from the last report.
  const changes = reportDay && !firstRun ? diffFreeModels(models, previous, providerInput) : undefined

  await update((draft) => {
    draft.version = 1
    draft.lastReportDay = reportDay || firstRun ? today : lastReportDay
    draft.lastStartAt = now.getTime()
    draft.models = snapshot
  })

  if (firstRun) {
    if (baselineShown) return
    baselineShown = true
    later(() => {
      context.ui.toast.show({
        title: "Free models",
        message: formatBaseline(freeCount),
        variant: "info",
        duration: 12000,
      })
    })
    return
  }

  if (!changes) return

  if (changes.models.length === 0 && changes.providers.length === 0) return
  if (shownDay === today) return
  shownDay = today

  const message = formatReport(changes, lastStartAt)

  // setup must finish before the TUI renders plugin UI. Defer the modal until
  // the host is ready, otherwise plugin loading waits on the dialog forever.
  later(() => {
    void context.ui.dialog
      .alert({ title: "New free models", message })
      .catch((error) => console.error("free-models: dialog failed", error))
  })
}

export default Plugin.define({
  id: "local.free-models",
  async setup(context) {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later: Later = (task) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        task()
      }, 750)
      timers.add(timer)
    }

    try {
      await report(context, later)
    } catch (error) {
      console.error("free-models: report failed", error)
      later(() => {
        context.ui.toast.show({
          title: "Free models",
          message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
          variant: "warning",
          duration: 8000,
        })
      })
    }

    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  },
})
