export type CostTier = {
  readonly input: number
  readonly output: number
  readonly cache: {
    readonly read: number
    readonly write: number
  }
}

export type ModelInput = {
  readonly id: string
  readonly providerID: string
  readonly name: string
  readonly cost: readonly CostTier[]
}

export type ProviderInput = {
  readonly id: string
  readonly name: string
}

export type SnapshotModel = {
  providerID: string
  id: string
  name: string
  free: boolean
}

export type Snapshot = Record<string, SnapshotModel>

export type State = {
  version: 1
  lastReportDay: string
  lastStartAt: number
  models: Snapshot
}

export const initialState: State = {
  version: 1,
  lastReportDay: "",
  lastStartAt: 0,
  models: {},
}

export type FreeModel = {
  providerID: string
  id: string
  name: string
  kind: "new" | "changed"
}

export type FreeProvider = {
  providerID: string
  name: string
  freeCount: number
  kind: "new" | "changed"
}

export type FreeReport = {
  models: FreeModel[]
  providers: FreeProvider[]
}

export function isFree(model: ModelInput): boolean {
  if (!model.cost || model.cost.length === 0) return false
  return model.cost.every(
    (tier) =>
      tier.input === 0 &&
      tier.output === 0 &&
      tier.cache.read === 0 &&
      tier.cache.write === 0,
  )
}

export function modelKey(providerID: string, id: string): string {
  return `${providerID}\u0000${id}`
}

export function localDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function buildSnapshot(models: readonly ModelInput[]): Snapshot {
  const snapshot: Snapshot = {}
  for (const model of models) {
    snapshot[modelKey(model.providerID, model.id)] = {
      providerID: model.providerID,
      id: model.id,
      name: model.name,
      free: isFree(model),
    }
  }
  return snapshot
}

export function diffFreeModels(
  current: readonly ModelInput[],
  previous: Readonly<Snapshot>,
  providers: readonly ProviderInput[] = [],
): FreeReport {
  const providerNames = new Map(providers.map((provider) => [provider.id, provider.name]))
  const knownProviders = new Set<string>()
  const previousFreeByProvider = new Map<string, number>()

  for (const record of Object.values(previous)) {
    knownProviders.add(record.providerID)
    if (!record.free) continue
    previousFreeByProvider.set(record.providerID, (previousFreeByProvider.get(record.providerID) ?? 0) + 1)
  }

  const models: FreeModel[] = []
  const currentFreeByProvider = new Map<string, number>()

  for (const model of current) {
    if (!isFree(model)) continue
    currentFreeByProvider.set(model.providerID, (currentFreeByProvider.get(model.providerID) ?? 0) + 1)

    const before = previous[modelKey(model.providerID, model.id)]
    if (before?.free) continue

    models.push({
      providerID: model.providerID,
      id: model.id,
      name: model.name,
      kind: before ? "changed" : "new",
    })
  }

  const providersNowFree: FreeProvider[] = []
  for (const [providerID, freeCount] of currentFreeByProvider) {
    if ((previousFreeByProvider.get(providerID) ?? 0) > 0) continue
    providersNowFree.push({
      providerID,
      name: providerNames.get(providerID) ?? providerID,
      freeCount,
      kind: knownProviders.has(providerID) ? "changed" : "new",
    })
  }

  models.sort((left, right) => left.providerID.localeCompare(right.providerID) || left.name.localeCompare(right.name))
  providersNowFree.sort((left, right) => left.name.localeCompare(right.name))
  return { models, providers: providersNowFree }
}

function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many
}

export function formatReport(report: FreeReport, since: number): string {
  const sinceText =
    since > 0
      ? new Date(since).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "the previous start"

  const lines: string[] = []
  if (report.models.length === 0) {
    lines.push(`No models became free since ${sinceText}.`)
  } else {
    lines.push(`${report.models.length} ${plural(report.models.length, "model")} became free since ${sinceText}:`)
    for (const model of report.models) {
      const tag = model.kind === "new" ? " (new)" : ""
      lines.push(`• ${model.name} — ${model.providerID}${tag}`)
    }
  }

  if (report.providers.length > 0) {
    lines.push("")
    lines.push(
      report.providers.length === 1
        ? "Provider now offering free models:"
        : "Providers now offering free models:",
    )
    for (const provider of report.providers) {
      lines.push(`• ${provider.name} — ${provider.freeCount} free ${plural(provider.freeCount, "model")}`)
    }
  }

  return lines.join("\n")
}

export function formatBaseline(freeCount: number): string {
  return `Free-model watch started. Tracking ${freeCount} free ${plural(freeCount, "model")}. The first report comes on the next day's first start.`
}
