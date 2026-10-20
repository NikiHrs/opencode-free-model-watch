import { describe, expect, test } from "bun:test"
import {
  buildSnapshot,
  diffFreeModels,
  formatBaseline,
  formatReport,
  isFree,
  localDay,
  modelKey,
  type ModelInput,
} from "./logic"

const freeCost = [{ input: 0, output: 0, cache: { read: 0, write: 0 } }]
const paidCost = [{ input: 1, output: 2, cache: { read: 0.1, write: 0.2 } }]

function model(overrides: Partial<ModelInput> = {}): ModelInput {
  return {
    id: "model",
    providerID: "provider",
    name: "Model",
    cost: freeCost,
    ...overrides,
  }
}

describe("isFree", () => {
  test("accepts a zero-cost tier", () => {
    expect(isFree(model())).toBe(true)
  })

  test("rejects a paid tier", () => {
    expect(isFree(model({ cost: paidCost }))).toBe(false)
  })

  test("rejects a mixed tier list", () => {
    expect(isFree(model({ cost: [...freeCost, ...paidCost] }))).toBe(false)
  })

  test("rejects missing cost data", () => {
    expect(isFree(model({ cost: [] }))).toBe(false)
  })
})

describe("localDay", () => {
  test("uses local date parts", () => {
    expect(localDay(new Date(2026, 9, 19, 23, 59))).toBe("2026-10-19")
  })
})

describe("diffFreeModels", () => {
  test("reports a model that changed from paid to free", () => {
    const previous = buildSnapshot([model({ id: "paid", name: "Paid", cost: paidCost })])
    const report = diffFreeModels([model({ id: "paid", name: "Paid" })], previous)

    expect(report.models).toEqual([
      { providerID: "provider", id: "paid", name: "Paid", kind: "changed" },
    ])
    expect(report.providers).toEqual([
      { providerID: "provider", name: "provider", freeCount: 1, kind: "changed" },
    ])
  })

  test("reports a new free model", () => {
    const report = diffFreeModels([model({ id: "new", name: "New" })], {})

    expect(report.models).toEqual([
      { providerID: "provider", id: "new", name: "New", kind: "new" },
    ])
    expect(report.providers[0]?.kind).toBe("new")
  })

  test("ignores a model that was already free", () => {
    const previous = buildSnapshot([model({ id: "free", name: "Free" })])
    const report = diffFreeModels([model({ id: "free", name: "Free" })], previous)

    expect(report.models).toEqual([])
    expect(report.providers).toEqual([])
  })

  test("does not relist a provider that already had a free model", () => {
    const previous = buildSnapshot([
      model({ id: "old", name: "Old" }),
      model({ id: "paid", name: "Paid", cost: paidCost }),
    ])
    const current = [
      model({ id: "old", name: "Old" }),
      model({ id: "paid", name: "Paid" }),
    ]

    const report = diffFreeModels(current, previous)

    expect(report.models.map((entry) => entry.id)).toEqual(["paid"])
    expect(report.providers).toEqual([])
  })

  test("uses provider display names", () => {
    const report = diffFreeModels(
      [model({ providerID: "acme" })],
      {},
      [{ id: "acme", name: "Acme" }],
    )

    expect(report.providers[0]?.name).toBe("Acme")
  })

  test("keys models by provider and id", () => {
    expect(modelKey("a/b", "c")).not.toBe(modelKey("a", "b/c"))
  })
})

describe("formatReport", () => {
  test("lists changed and new free models", () => {
    const message = formatReport(
      {
        models: [
          { providerID: "provider", id: "a", name: "Alpha", kind: "changed" },
          { providerID: "provider", id: "b", name: "Beta", kind: "new" },
        ],
        providers: [{ providerID: "provider", name: "Provider", freeCount: 2, kind: "changed" }],
      },
      0,
    )

    expect(message).toContain("2 models became free since the previous start:")
    expect(message).toContain("• Alpha — provider")
    expect(message).toContain("• Beta — provider (new)")
    expect(message).toContain("Provider now offering free models:")
    expect(message).toContain("• Provider — 2 free models")
  })

  test("reports a day with no change", () => {
    const message = formatReport({ models: [], providers: [] }, 0)
    expect(message).toBe("No models became free since the previous start.")
  })
})

describe("formatBaseline", () => {
  test("uses a singular model", () => {
    expect(formatBaseline(1)).toContain("Tracking 1 free model.")
  })
})
