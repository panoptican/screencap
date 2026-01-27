# Bug Reports & Feature Requests for screencap

Based on local modifications and testing. Ready for submission to the maintainer.

---

## Bug Reports

### Bug #1: Capture scheduler hangs indefinitely when capture operation stalls

**Type:** Bug Report

**Description:**
The capture scheduler uses a lock to prevent concurrent capture operations. However, if a capture operation hangs indefinitely (e.g., due to system permission issues, display driver problems, or OCR processing stalls), the lock is never released, causing all subsequent scheduled and manual captures to be skipped silently.

**Steps to Reproduce:**
1. Start screencap with the scheduler running
2. Trigger a condition where the capture pipeline stalls (e.g., disconnect external display during capture)
3. Observe that all subsequent captures are skipped with "Capture already in progress"

**Expected Behavior:**
The scheduler should detect stale locks and recover automatically, continuing to capture after a reasonable timeout.

**Proposed Solution:**
Add a timeout mechanism (e.g., 60 seconds) that force-releases stale capture locks:

```typescript
const CAPTURE_TIMEOUT_MS = 60 * 1000; // 60 seconds max
let captureLockAcquiredAt: number | null = null;

function checkAndReleaseStaleLock(): boolean {
  if (captureLock && captureLockAcquiredAt) {
    const heldFor = Date.now() - captureLockAcquiredAt;
    if (heldFor > CAPTURE_TIMEOUT_MS) {
      logger.warn("Capture lock held too long, force releasing", {
        heldForMs: heldFor,
        timeoutMs: CAPTURE_TIMEOUT_MS,
      });
      captureLock = null;
      captureLockAcquiredAt = null;
      return true;
    }
  }
  return false;
}
```

**Environment:**
- macOS 14.x
- screencap v1.17.x

---

### Bug #2: Scheduler tick errors cause unhandled promise rejections

**Type:** Bug Report

**Description:**
The scheduler's `setInterval` callback calls the async `tick()` function but does not catch any errors, leading to unhandled promise rejections that may crash the app or cause undefined behavior.

**Current Code:**
```typescript
captureInterval = setInterval(() => {
  tick(); // No error handling!
}, intervalMs);
```

**Expected Behavior:**
Errors in the scheduler tick should be logged but not crash the scheduler.

**Proposed Fix:**
```typescript
captureInterval = setInterval(() => {
  tick().catch((error) => {
    logger.error("Scheduler tick failed:", error);
  });
}, intervalMs);
```

---

### Bug #3: React accessibility warnings for missing aria-describedby

**Type:** Bug Report
**Severity:** Low (console warning, no functional impact)

**Description:**
The `DialogContent` component from Radix UI generates console warnings when used without an explicit `aria-describedby` attribute, even when no description is intended.

**Console Warning:**
```
Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
```

**Proposed Fix:**
Add `aria-describedby={undefined}` to DialogContent components that intentionally omit descriptions:

```tsx
<DialogContent
  className="..."
  aria-describedby={undefined}
>
```

---

## Feature Requests

### Feature #1: Virtual Scrolling for Timeline Performance

**Type:** Feature Request
**Priority:** High

**Problem:**
When users accumulate thousands of screenshot events, the timeline becomes sluggish. The current implementation renders all visible events as DOM nodes, causing:
- Slow initial load times
- Janky scrolling
- High memory usage
- Poor performance on older machines

**Proposed Solution:**
Implement virtualized scrolling using `@tanstack/react-virtual` that only renders visible items plus a small overscan buffer.

**Key Implementation Details:**

1. **Virtual Timeline Component** using `useVirtualizer`:
```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: (index) => {
    const item = items[index];
    return item?.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT;
  },
  overscan: 3,
});
```

2. **Responsive Grid Columns** via ResizeObserver:
```typescript
export function useResponsiveColumns(containerRef: RefObject<HTMLElement>): number {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width >= 1280) setColumns(4);
      else if (width >= 1024) setColumns(3);
      else if (width >= 768) setColumns(2);
      else setColumns(1);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return columns;
}
```

3. **Virtual Item Types** (headers and rows):
```typescript
type VirtualTimelineItem =
  | { type: "header"; date: string; key: string; events: Event[] }
  | { type: "row"; events: Event[]; key: string };
```

**Benefits:**
- Constant memory usage regardless of event count
- Smooth 60fps scrolling
- Instant navigation between pages
- Works with existing date-grouped layout

**UI Preview:**
The timeline maintains the same visual appearance with date headers and grid layout, but only renders ~10-15 rows at a time regardless of total events.

---

### Feature #2: Enhanced Pagination with Total Page Count

**Type:** Feature Request
**Priority:** Medium

**Problem:**
The current pagination shows only "Previous/Next" buttons with no indication of how many pages exist or where the user is in the dataset.

**Proposed Solution:**
Display "Page X of Y" with navigation controls.

**Implementation:**

1. **Backend: Add `getEventsCount` endpoint:**
```typescript
export function getEventsCount(options: GetEventsOptions): number {
  const query = `SELECT COUNT(*) as count FROM events WHERE ${conditions.join(" AND ")}`;
  const row = db.prepare(query).get(...params) as { count: number };
  return row.count;
}
```

2. **Frontend: Fetch count alongside events:**
```typescript
const [result, count] = await Promise.all([
  window.api.storage.getEvents({ ...filters, limit: pageSize + 1, offset }),
  window.api.storage.getEventsCount(filters),
]);
setTotalPages(Math.max(1, Math.ceil(count / pageSize)));
```

3. **UI Component:**
```tsx
<div className="flex items-center gap-1 text-xs text-muted-foreground">
  <span>Page {pagination.page + 1} of {totalPages}</span>
  <Button disabled={pagination.page === 0} onClick={() => setPagination({ page: page - 1 })}>
    <ChevronLeft />
  </Button>
  <Button disabled={!hasNextPage} onClick={() => setPagination({ page: page + 1 })}>
    <ChevronRight />
  </Button>
</div>
```

**UI Preview:**
```
                                            Page 3 of 47  [<] [>]
┌─────────────────────────────────────────────────────────────────┐
│  January 26, 2026                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
```

---

### Feature #3: Addiction Tracking Filters and Review Workflow

**Type:** Feature Request
**Priority:** Medium

**Problem:**
Users who track addictive behaviors via screencap's addiction detection feature need a way to:
1. Filter the timeline to show only events that need addiction review
2. Filter by specific tracked addictions
3. Quickly bulk-confirm or reject addiction candidates

**Proposed Solution:**

**A. New Timeline Filters:**

1. **"Needs Review" toggle button** - Shows only events where `addiction_candidate IS NOT NULL AND tracked_addiction IS NULL`

2. **Addiction dropdown filter** - Filter by specific tracked addiction (e.g., "YouTube", "Twitter")

```tsx
<Button
  variant={filters.needsAddictionReview ? "secondary" : "outline"}
  onClick={toggleNeedsReview}
>
  <AlertCircle className="h-4 w-4" />
  Needs Review
</Button>

<Combobox
  value={filters.trackedAddiction}
  onValueChange={handleAddictionChange}
  placeholder="Addiction"
  options={addictionOptions}
/>
```

**B. Bulk Confirm Action in Date Headers:**

When "Needs Review" filter is active, each date header shows a "Confirm all (N)" button:

```tsx
{needsReviewFilter && needsReviewIds.length > 0 && (
  <Button
    variant="ghost"
    size="sm"
    className="text-amber-500"
    onClick={handleConfirmAll}
  >
    <Check className="h-3 w-3 mr-1" />
    Confirm all ({needsReviewIds.length})
  </Button>
)}
```

**C. Promoted Addiction Section in Event Preview:**

Move the addiction tracking UI to the top of the event preview modal (before category/project) for better visibility when reviewing.

**UI Preview (Filters bar):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search...  │ Category ▼ │ App ▼ │ Website ▼ │ 🔥 Addiction ▼ │            │
│                                                                         │
│ [Progress only]  [⚠️ Needs Review]                     Page 1 of 12    │
└──────────────────────────────────────────────────────────────────┘
```

**UI Preview (Date header with bulk action):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  January 26, 2026                          ✓ Confirm all (3)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ 🔥 YouTube   │  │ 🔥 Twitter   │  │ 🔥 Reddit    │                  │
```

**Backend Support:**
Add `needsAddictionReview` filter option to `getEvents` and `getEventsCount`:

```typescript
if (options.needsAddictionReview) {
  conditions.push(
    "addiction_candidate IS NOT NULL AND tracked_addiction IS NULL"
  );
}
```

---

## Summary

| Type    | Title                                        | Priority |
|:--------|:---------------------------------------------|:---------|
| Bug     | Capture scheduler hangs on stale lock        | High     |
| Bug     | Unhandled promise rejection in scheduler     | Medium   |
| Bug     | Missing aria-describedby warnings            | Low      |
| Feature | Virtual scrolling for timeline               | High     |
| Feature | Total page count in pagination               | Medium   |
| Feature | Addiction tracking filters & review workflow | Medium   |
