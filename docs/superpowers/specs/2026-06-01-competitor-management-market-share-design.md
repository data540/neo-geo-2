# Competitor Management in Market Share — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## Problem

1. Geographic abbreviations like LATAM, EMEA, APAC are auto-detected as competitor brands and appear in the Market Share donut chart.
2. There is no way to delete a competitor directly from the Dashboard — the user must navigate to `/competitors` to do so.

## Goal

- Allow the user to delete a competitor directly from the Market Share legend with a single click.
- Prevent geographic abbreviations from being auto-detected as competitors in future prompt runs.

## Out of Scope

- Soft-hide (exclude from chart without deleting)
- Undo / history
- Bulk delete
- Competitor reordering

---

## Architecture

### Part A — Delete button in Market Share donut

**Component:** `src/components/dashboard/MarketShareDonut.tsx`

Already a Client Component (`"use client"`). Changes:

- Add `workspaceId: string` to the `Props` interface.
- Add `hoveredIndex: number | null` state.
- On each legend row (`chartData.map`): wrap in `onMouseEnter`/`onMouseLeave` to set `hoveredIndex`.
- Render a `×` button (Lucide `X` icon, 12px) at the end of each row **only when**:
  - `hoveredIndex === index`, AND
  - `entry.isOwn === false`, AND
  - `entry.name` does not start with `+` (i.e. it is not the aggregated "rest" entry)
- On click: set `deleting` state for that index, call `deleteCompetitorAction(entry.brandId, workspaceId)`, then call `router.refresh()`. Show `sonner` toast "Competidor eliminado".
- The `brandId` is already available in `chartData` entries — extend the local `chartData` map to include `brandId: d.brandId`.

**Caller:** `src/app/(app)/[workspace]/dashboard/page.tsx`

- Pass `workspaceId={workspace.id}` to `<MarketShareDonut>`.

No changes to `MarketShareEntry` type, RPCs, or database.

---

### Part B — Geographic abbreviation exclusions

Add the following normalized strings to both exclusion lists:

```
latam, emea, apac, mena, dach, amer, cee, ue, ee uu
```

**File 1:** `src/lib/detection/detectBrands.ts` — `GENERIC_NON_BRANDS` Set (line 26)

**File 2:** `src/actions/competitors.ts` — `GENERIC_EXCLUSIONS` Set (line 10)

These lists are used during:
- `extractPotentialCompetitorsFromResponse()` — auto-detection from prompt runs
- `shouldKeepCompetitorCandidate()` — filtering candidates before inserting to DB

---

## Data Flow

```
RPC get_workspace_market_share
  → MarketShareEntry[] (brandId already included)
  → MarketShareDonut props (data, workspaceId)
  → user hovers row → × button appears
  → user clicks × → deleteCompetitorAction(brandId, workspaceId)
  → revalidatePath(`/${slug}/competitors`) + router.refresh()
  → donut re-renders without deleted brand
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/MarketShareDonut.tsx` | Add `workspaceId` prop, hover state, `×` button with delete action |
| `src/app/(app)/[workspace]/dashboard/page.tsx` | Pass `workspaceId` to `<MarketShareDonut>` |
| `src/lib/detection/detectBrands.ts` | Add geographic abbreviations to `GENERIC_NON_BRANDS` |
| `src/actions/competitors.ts` | Add geographic abbreviations to `GENERIC_EXCLUSIONS` |

No migrations, no RPC changes, no type changes.

---

## Error Handling

- If `deleteCompetitorAction` returns `{ success: false }`, show toast error with `result.error`.
- Button is disabled while `deleting` state is active to prevent double-clicks.
- Own brand row never shows `×` button (guarded by `entry.isOwn`).
