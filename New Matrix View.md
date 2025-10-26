# Workflow Matrix: Micro‑steps Behavior Spec

## Scope

This document defines the interaction model for task **micro‑steps** in the single‑row workflow matrix used for Underclass/Retakes/Sports.

## Entities

* **Task cell**: one cell in a job row for a specific task.
* **Micro‑step**: a small checklist item attached to a task.
* **Meter**: compact `done/total` display with a progress bar inside a task cell.

## Interaction Model

1. **Idle state**

   * Cell shows: `initials` input, status icon (clock/✔), the **meter** (`x/y` + bar), and a date field (not in tab order).
   * “Done” color: dark blue background when the task is done.

2. **Hover (read‑only preview)**

   * Trigger: hover **over the meter only**.
   * Show a **read‑only tooltip** listing every micro‑step with filled/empty dots and a `x/y complete` footer.
   * No layout shift. No clicks. No state change.

3. **Click (interactive checklist)**

   * Trigger: click the **meter**.
   * Result: an **inline panel** expands **inside that cell** (row height increases). It contains checkboxes for each micro‑step.
   * The panel closes when the mouse leaves the meter area (or the panel), or when the user clicks the meter again.

4. **Done rule**

   * `task.done = (initials present) OR (all micro‑steps checked)`.
   * When `task.done` becomes true for the first time and `date` is empty → auto‑fill `date = today (YYYY‑MM‑DD)`.

5. **Initials lock**

   * Initials remain editable **until** all micro‑steps are checked.
   * When all micro‑steps are checked, **lock** the initials field.

6. **Keyboard**

   * Tab order: **initials only**. Meter, checkboxes, and date are **skipped** (tabIndex −1).
   * ESC closes the open checklist (optional enhancement).

7. **Dates**

   * User can override the auto‑filled date manually. Editing date does **not** unlock initials.

## Data Model

```ts
// Per task cell
interface MicroState { key: string; done: boolean }
interface CellState {
  initials: string;
  date: string;        // YYYY‑MM‑DD
  done: boolean;
  micro?: MicroState[]; // only present when task defines micro‑steps
}
```

**Derivations**

* `allMicrosDone(micro): boolean` → `micro?.length>0 && micro.every(m=>m.done)`.
* Normalize storage so missing micro‑steps default to `{done:false}`.

## State Transitions

* **Toggle micro** → recompute `allMicrosDone`; set `done = allMicrosDone || !!initials`; if `done && !date`, set `date=today`.
* **Edit initials** → set `initials = UPPERCASE`; set `done = !!initials || allMicrosDone`; if `done && !date`, set `date=today`.
* **Edit date** → set `date = value`; if not `done`, set `done = !!initials || allMicrosDone`.

## Edge Cases

* Tasks with **no micro‑steps**: hide meter; initials alone can mark done.
* **Unchecking** a micro after initials entered: `done` stays true due to initials.
* **All micro‑steps done, no initials**: initials lock; task is done; date auto‑fills.

## Acceptance Tests

1. Hovering the meter shows a read‑only list; moving away hides it.
2. Clicking the meter expands an inline checklist; leaving the meter/panel closes it.
3. Initials lock **only when** all micro‑steps are checked.
4. `done` becomes true when either initials exist or all micro‑steps are checked.
5. On first transition to `done=true`, an empty `date` auto‑fills with today.
6. Tab moves from Job → School → first task **initials**; it **skips** the date and meter.

---

## Example React Implementation (extract)

> This example shows the **meter**, **hover preview**, **inline checklist**, and the **done/lock** rules. Drop into your matrix.

```tsx
import React, { useState } from "react";

type Micro = { key: string; label: string };
type MicroState = { key: string; done: boolean };
export type CellState = { initials: string; date: string; done: boolean; micro?: MicroState[] };

export function allMicrosDone(m?: MicroState[]) {
  return !!m && m.length > 0 && m.every(x => x.done);
}

function normalizeMicros(defs: Micro[], cell: CellState): MicroState[] | undefined {
  if (!defs) return undefined;
  const byKey = Object.fromEntries((cell.micro || []).map(m => [m.key, m]));
  return defs.map(d => byKey[d.key] || { key: d.key, done: false });
}

export function MicroMeter({
  label,
  defs,
  cell,
  onToggle,
}: {
  label: string;
  defs: Micro[];
  cell: CellState;
  onToggle: (k: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const micros = normalizeMicros(defs, cell)!;
  const total = micros.length;
  const done = micros.filter(m => m.done).length;
  const pct = Math.round((done / Math.max(1, total)) * 100);

  return (
    <div className="relative w-24 select-none" onMouseLeave={() => { setHover(false); setOpen(false); }}>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <button tabIndex={-1} title={`${done}/${total}`} className="w-full text-[10px] border rounded-md overflow-hidden" onClick={() => setOpen(v => !v)}>
          <div className="h-3 bg-zinc-100 relative"><div className="absolute inset-y-0 left-0 bg-blue-700" style={{ width: `${pct}%` }} /></div>
          <div className="py-0.5 text-blue-900 bg-blue-50">{done}/{total}</div>
        </button>
        {hover && !open && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white border rounded-md shadow p-2 z-40 text-[10px] w-56 pointer-events-none">
            <div className="mb-1 font-medium">{label}</div>
            <ul className="space-y-0.5">{micros.map(m => (
              <li key={m.key} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-full border ${m.done ? 'bg-blue-700 border-blue-700' : 'bg-white border-zinc-300'}`}/>
                <span>{defs.find(d => d.key === m.key)?.label}</span>
              </li>
            ))}</ul>
            <div className="mt-1 text-right text-[10px] text-zinc-500">{done}/{total} complete</div>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-md border bg-white shadow-sm p-2 text-[11px] w-full">
          {micros.map(m => (
            <label key={m.key} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" tabIndex={-1} checked={m.done} onChange={() => onToggle(m.key)} />
              <span>{defs.find(d => d.key === m.key)?.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// Example usage inside your TaskCell
function TaskCell({ label, defs, value, onChange }: { label: string; defs?: Micro[]; value: CellState; onChange: (v: CellState) => void }) {
  const setInitials = (val: string) => {
    const next: CellState = { ...value, initials: val.toUpperCase(), done: !!val || allMicrosDone(value.micro) };
    if (next.done && !next.date) next.date = new Date().toISOString().slice(0,10);
    onChange(next);
  };
  const setDate = (ymd: string) => {
    const next: CellState = { ...value, date: ymd };
    if (ymd && !next.done) next.done = !!value.initials || allMicrosDone(value.micro);
    onChange(next);
  };
  const toggleMicro = (k: string) => {
    if (!defs) return;
    const cur = value.micro || [];
    const has = new Map(cur.map(m => [m.key, m]));
    const nextMicros = defs.map(d => (has.get(d.key) || { key: d.key, done: false }));
    for (const m of nextMicros) if (m.key === k) m.done = !m.done;
    const next: CellState = { ...value, micro: nextMicros, done: allMicrosDone(nextMicros) || !!value.initials };
    if (next.done && !next.date) next.date = new Date().toISOString().slice(0,10);
    onChange(next);
  };
  return (
    <td className={`px-2 py-1 border align-top ${value.done ? 'bg-blue-200 text-blue-900' : 'bg-zinc-50'}`} title={label}>
      <div className="flex flex-col items-center gap-1 text-[11px]">
        <div className="flex items-center gap-1">
          <input className="w-12 rounded-md border px-1 py-0.5 text-center" placeholder="Init" value={value.initials} onChange={(e) => setInitials(e.target.value)} />
          {value.done ? '✔' : '⏱'}
        </div>
        {defs && <MicroMeter label={label} defs={defs} cell={value} onToggle={toggleMicro} />}
        <input type="date" tabIndex={-1} className="w-24 rounded-md border px-1 py-0.5" value={value.date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </td>
  );
}
```

---

## Minimal JSON Example

```json
{
  "jobId": "J-1001",
  "taskKey": "color",
  "cell": {
    "initials": "AD",
    "date": "2025-10-24",
    "done": true,
    "micro": [
      { "key": "wb", "done": true },
      { "key": "exposure", "done": true },
      { "key": "skin", "done": false }
    ]
  }
}
```

## Notes for Integration

* Persist each cell change with a single PATCH

  * Path: `/jobs/{jobId}/tasks/{taskKey}`
  * Body: `{ initials?, date?, done?, micro? }`
* Role‑based read‑only can be enforced at the cell level.
* Add virtualization for 500+ jobs.

## Outstanding Clarifications

* Confirm whether ESC should close the inline checklist.
* Confirm if unchecking a micro should **unset** `done` even when initials were entered earlier (current spec: **no**, initials keep it done).
