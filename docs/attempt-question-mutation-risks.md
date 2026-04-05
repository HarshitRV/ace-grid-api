# Attempt Integrity: Question Mutation Risks

## Context

When a user starts an exam attempt (`POST /api/attempts`), the current question IDs for the exam are
snapshotted into the attempt's `answers` array. Submission (`PATCH /api/attempts/:id/submit`) then
validates and scores against a **live** re-fetch of those questions.

This creates a window of inconsistency if an admin mutates the exam's questions while an attempt is
`in_progress`.

The relevant code lives in `AttemptsController.submitAnswers` — specifically step 4:

```ts
// 4. Fetch canonical correct answers for the attempt's own exam/questions.
const questions = await Question.find({
    examId: attempt.examId,
    _id: { $in: expectedQuestionIds },
})
    .select("_id correctIndex")
    .lean();
if (questions.length !== expectedSet.size) {
    throw new HttpError(409, "CONFLICT", "Attempt question set is out of sync. Start a new attempt.");
}
```

---

## Scenarios

### ✅ Scenario 1 — Admin adds a question (No issue)

**What happens:** Admin adds a new question to an exam that has active attempts.

**Impact:** None. `expectedQuestionIds` is fixed to the IDs snapshotted at `startAttempt`. The new
question is never in scope for existing attempts. The `Question.find` query is scoped to those IDs
only.

**Verdict:** Safe, no action needed.

---

### 🔴 Scenario 2 — Admin deletes a question (Hard failure)

**What happens:** Admin permanently deletes a question that is part of an active attempt's `answers`.

**Impact:** At submit time, `Question.find({ _id: { $in: expectedQuestionIds } })` can't find the
deleted document. `questions.length < expectedSet.size` → the guard throws a `409 CONFLICT`. The
user **cannot submit their completed attempt** — a hard, user-facing failure.

**Verdict:** Critical bug. Must be fixed.

---

### 🟡 Scenario 3 — Admin edits `correctIndex` mid-attempt (Silent wrong scoring)

**What happens:** Admin fixes a wrong answer on a question while users have active attempts.

**Impact:** Scoring fetches the *live* `correctIndex` at submit time. A user who answered correctly
against the original answer key may now be marked wrong (or vice versa). No error is thrown — the
damage is silent and invisible.

**Verdict:** High risk for a fair exam platform. Must be addressed.

---

### 🟡 Scenario 4 — Admin edits question text/options mid-attempt (UX inconsistency)

**What happens:** Admin updates the wording of a question or shuffles its options while a user is
mid-attempt.

**Impact:** The user read version A of the question but their stored `selectedIndex` is scored
against version B's option order. Could silently corrupt scores if option order changed.

**Verdict:** Medium risk. Lower priority than Scenario 3 but worth noting.

---

## Potential Solutions

### Option A — Block admin mutations when exam has active attempts ⭐ Recommended

Any `POST`, `PATCH`, or `DELETE` on a question (or the exam's question list) first checks:

```ts
const hasActiveAttempts = await Attempt.exists({ examId, status: "in_progress" });
if (hasActiveAttempts) throw new HttpError(409, "CONFLICT", "Cannot modify an exam with active attempts.");
```

**Pros:**
- No schema changes required
- Explicit, auditable contract (admin gets a clear error)
- Fixes all scenarios (2, 3, 4) at the source
- Fairness is enforced by design — all users take the same exam

**Cons:**
- Admin is blocked until all active attempts expire or complete
- Could be friction for high-traffic exams that always have someone in-progress

**Fixes:** Scenarios 2 ✅ | 3 ✅ | 4 ✅

---

### Option B — Snapshot `correctIndex` at `startAttempt` time

Extend the `IAnswer` / `answers` subdocument to store `correctIndex` when the attempt is created:

```ts
// answers subdocument
{ questionId: ObjectId, selectedIndex: null, correctIndex: number | null }
```

Score against the snapshot at submit time instead of re-fetching from `Question`.

**Pros:**
- Fully isolated — admin can mutate questions freely without breaking active attempts
- Correct scoring even if admin changes the answer key

**Cons:**
- Requires schema migration on `Attempt.answers`
- Snapshotted wrong answer keys are permanently wrong for that attempt
- Doesn't protect against Scenario 2 (deleted question still missing from the snapshot if it was
  deleted before attempt start... though that's less likely)

**Fixes:** Scenario 3 ✅ | 4 (partial) | Does NOT fix Scenario 2 on its own

---

### Option C — Soft-delete questions

Instead of hard-deleting, mark questions as `{ deleted: true }` and filter them out of normal
queries.

**Pros:**
- Fixes Scenario 2 — deleted questions are still queryable by the attempt's submission flow
- Questions remain in the DB for audit/history

**Cons:**
- Schema change on `Question` model
- All question queries need a `{ deleted: { $ne: true } }` guard
- Admin UX needs a "deleted" state

**Fixes:** Scenario 2 ✅ | Does NOT fix Scenarios 3 or 4

---

### Option D — Combine A + C (Most robust)

- **Block `correctIndex` / option edits** when active attempts exist (Option A, scoped)
- **Soft-delete questions** so deletion never orphans active attempt answers (Option C)
- Allow cosmetic edits (typo fixes in question text) freely

**Fixes:** All scenarios ✅

---

## Recommendation

**Start with Option A** — it's the lowest effort, zero schema changes, and enforces fair exam
semantics by design. Revisit soft-delete (Option C) only if the product requires admins to be able
to remove questions from live exams without waiting.
