# QA Test Plan — Yoga Roster

This plan maps every epic and user story in [`yoga-lesson-management-app-mvp-plan.md`](./yoga-lesson-management-app-mvp-plan.md) to the automated test(s) that cover it, based on an audit of both the plan and the actual implemented code, routes, and UI as of this writing. Real implementation always drifts from the original plan somewhat — some drift is *more* was built than documented (see [Implemented but undocumented](#implemented-but-undocumented)), and some is *less* was built than the plan describes (marked `NOT IMPLEMENTED` below). Both directions are called out explicitly rather than silently tested around.

**Update this file whenever a capability is added or existing behavior changes** — that's the agreed workflow for this project, not just a one-time exercise.

## Methodology note: what "unit" vs "integration" means here

This app has no separate REST API or service layer — the business logic lives directly inside Next.js Server Actions (`src/app/actions/*.ts`), which read cookies and call `redirect()`/`revalidatePath()` internally. Given that architecture, the two layers are split by **scope and purpose**, not by mechanism:

- **Unit tests** (`*.unit.test.ts`) — pure functions with zero I/O: `src/lib/phone.ts`, `src/lib/week.ts`. No database, no mocks needed.
- **Integration tests** (`*.int.test.ts`) — Server Actions invoked directly as plain async functions (no HTTP layer, no browser) against a real, ephemeral SQLite database created fresh per test file (`src/test/testDb.ts`, replaying the actual Prisma migrations). Next's request-scoped APIs (`cookies()`, `redirect()`, `revalidatePath()`) are stubbed (`src/test/nextMocks.ts`) since they only work inside a real request lifecycle. This is the layer that covers both "business logic" (credits, capacity, waitlist) and "endpoint" behavior (validation, auth, ownership) the task brief asked for, since in this codebase they're the same functions.
- **E2E tests** (`tests/e2e/*.spec.ts`, Playwright) — full browser journeys against a real running Next.js dev server and a real (ephemeral) SQLite file, exercising the actual UI.

Every test file — unit, integration, or e2e — gets its own throwaway database or in-memory state. Nothing is shared between test files, nothing needs manual cleanup, and nothing ever touches `dev.db` (the real local data file) or a production database.

## WhatsApp: nothing to mock

The MVP intentionally ships with **manual** WhatsApp sending (the teacher clicks "publish," a link is copied to her clipboard, and she pastes it into WhatsApp herself). There is no WhatsApp-sending code in this codebase at all — no session, no library, no API call — so there is nothing to stub or mock. If/when the Phase 2 automated WhatsApp integration (Baileys/whatsapp-web.js) described in the original build prompt is built, this plan and test suite must be updated to add a mocked sending layer at that time, per the constraint that no test may ever call a real WhatsApp session.

---

## Story-to-test traceability

| Epic | Story | Status | Test(s) |
|---|---|---|---|
| Teacher Accounts & Multi-Tenant Foundation | Teacher creates an account and logs in | ✅ Implemented | `src/app/actions/auth.int.test.ts` — valid signup, missing name, invalid email, short password, duplicate email, case-insensitive email match, correct/incorrect login, logout. Exercised end-to-end via `signupTeacher()` in every e2e spec. |
| Teacher Accounts & Multi-Tenant Foundation | Teacher data stays isolated from other teachers | ✅ Implemented | `lessons.int.test.ts` (update/delete ownership checks), `students.int.test.ts` (update ownership, duplicate-phone-per-teacher, same phone allowed under a different teacher), `registrations.int.test.ts` (`manualRegisterStudentAction`/`teacherCancelRegistrationAction` ownership checks; a foreign teacher's lesson id is silently ignored by `updateRegistrationsAction`). |
| Weekly Lesson Planning | Teacher creates a lesson | ✅ Implemented | `lessons.int.test.ts` (`createLessonAction`: valid, missing title, non-positive capacity/duration, invalid date), `tests/e2e/teacher-lessons.spec.ts`. |
| Weekly Lesson Planning | Teacher edits or deletes a lesson | ⚠️ Partially implemented | `lessons.int.test.ts` (`updateLessonAction` valid edit + validation; `deleteLessonAction` valid delete). **Gaps** (tested to document current behavior, not to assert it's correct): no warning when lowering capacity below the current registered count; deleting a lesson with an active registration throws an unhandled DB foreign-key error instead of a friendly message or an affected-student list. |
| Weekly Lesson Planning | Teacher copies last week's plan | ✅ Implemented | `lessons.int.test.ts` (`copyPreviousWeekAction`: success/shifted-by-7-days, empty state, blocked when target week already ended — see [Implemented but undocumented](#implemented-but-undocumented)), `tests/e2e/teacher-lessons.spec.ts`. |
| Publish & Notify Students | Teacher generates the weekly announcement message | ⚠️ Implemented differently | `registrations.int.test.ts` (`publishWeekAction`: blocks an empty week, publishes, idempotent upsert), exercised e2e via `publishWeekAndGetLink()`. **Gap:** there is no Hebrew announcement-message generator — publishing just gates public visibility and the UI copies a plain plan URL to the clipboard. |
| Publish & Notify Students | Teacher generates a lesson-cancellation message | ❌ NOT IMPLEMENTED | No reason field, no message generator exists anywhere in the code. No test possible. |
| Student Identification & Sign-Up | Student identifies herself by phone number | ⚠️ Partially implemented | `registrations.int.test.ts` (`identifyStudentAction`: creates new student + splits name, recognizes returning student by exact phone match without duplicating, rejects empty name, restricts an off-site `returnTo` open-redirect). `tests/e2e/student-registration.spec.ts` covers cookie-based return-visit recognition. **Gap:** no phone-format validation on this endpoint (unlike the teacher-side student form) — any string is accepted, tested explicitly. **Gap:** "autofill" of saved name/email on a new device using a known phone number is not implemented — the backend silently reuses the existing record, but the form never shows her saved details. |
| Lesson Sign-Up, Waitlist & Cancellation | Student views and selects this week's lessons | ✅ Implemented | Exercised throughout `tests/e2e/student-registration.spec.ts` (capacity/status shown per lesson). |
| Lesson Sign-Up, Waitlist & Cancellation | Student registers for one or more lessons | ✅ Implemented | `registrations.int.test.ts` — credit deducted on an open lesson, waitlisted with no deduction once full, waitlisting confirmed across two students in sequence, zero-credit and negative-credit balances never block registration. `tests/e2e/student-registration.spec.ts` (golden path). |
| Lesson Sign-Up, Waitlist & Cancellation | Student sees her registration confirmation | ✅ Implemented | `tests/e2e/student-registration.spec.ts` — asserts "registered"/"waitlisted" copy and the credit-balance line. |
| Lesson Sign-Up, Waitlist & Cancellation | Student cancels a registration before the cutoff | ⚠️ Partially implemented | `registrations.int.test.ts` — cancelling a registered (non-waitlisted) lesson refunds a deducted credit; cancelling a waitlisted entry refunds nothing (none was ever deducted). **Gaps** (tested to document current behavior): there is no cutoff at all — cancellation succeeds even after the lesson has already started; the next waitlisted student is never auto-promoted when a spot opens up. |
| Credits & Packages | Teacher defines a package type | ❌ NOT IMPLEMENTED | No `Package`/package-type model exists — a student has only a raw `credits: Int`. No test possible. |
| Credits & Packages | Teacher assigns or tops up a student's package | ⚠️ Implemented differently | `students.int.test.ts` (credits field validated and saved on create/edit), `tests/e2e/teacher-roster-management.spec.ts` (credit balance edited from the student form). There is no package/unlimited concept — just a directly-editable number. |
| Credits & Packages | Registration and cancellation adjust credit balance correctly | ✅ Implemented (for the credit-count model that exists) | `registrations.int.test.ts` — full deduction/waitlist/refund matrix. **Gap:** "unlimited package, no deduction" cannot be tested since unlimited packages don't exist. |
| Teacher Dashboard & Lesson Roster | Teacher views weekly registration counts | ✅ Implemented | Implicit in `tests/e2e/teacher-lessons.spec.ts` and `teacher-roster-management.spec.ts` (X/Y counts shown per lesson row and in the roster panel). |
| Teacher Dashboard & Lesson Roster | Teacher views and edits a lesson's full roster | ✅ Implemented | `registrations.int.test.ts` (`manualRegisterStudentAction` incl. capacity block — see [Implemented but undocumented](#implemented-but-undocumented) — and duplicate-registration rejection; `teacherCancelRegistrationAction` incl. refund). `tests/e2e/teacher-roster-management.spec.ts` — full manual add/remove/capacity-block journey through the UI. **Minor gap:** the roster view shows name and phone but not each student's credit balance, as the plan calls for. |
| Student Roster Management | Teacher adds a student manually | ✅ Implemented | `students.int.test.ts` (`createStudentAction`), exercised e2e via `addStudentViaUI()` in multiple specs. |
| Student Roster Management | Teacher disables a student without losing history | ❌ NOT IMPLEMENTED | No active/disabled field exists on `Student`. No test possible. |
| Student Roster Management | Teacher views a student's upcoming and past lessons | ❌ NOT IMPLEMENTED | No student profile/history page exists — the students screen is only a list with an edit modal. No test possible. |
| Security & Abuse Prevention | Sign-up endpoint resists scripted abuse | ❌ NOT IMPLEMENTED | No rate limiting and no honeypot field exist anywhere. Phone-format validation exists for the **teacher-side** student form (`students.int.test.ts`) but explicitly *not* for the public student self-identify endpoint (documented as a gap in `registrations.int.test.ts`). |

---

## Implemented but undocumented

Real behavior found in the codebase that isn't described in the MVP plan — this is the list to back-fill into the plan/PRD:

1. **Manual teacher-side registration now enforces lesson capacity.** Adding a student to an already-full lesson from the roster screen is blocked with `"השיעור מלא, לא ניתן להוסיף תלמידה נוספת."` The plan only says a manually-added student "is registered... even if published," without addressing the at-capacity case. Tested in `registrations.int.test.ts` and `tests/e2e/teacher-roster-management.spec.ts`.
2. **Lesson creation is blocked in the past.** `createLessonAction` rejects any `startsAt` earlier than now. Tested in `lessons.int.test.ts`.
3. **Copying the previous week is blocked if the *target* week has already ended**, in addition to the documented "no previous week exists" empty state. Tested in `lessons.int.test.ts`.
4. **Duplicate phone numbers are rejected per teacher** on student create/edit, with the correct multi-tenant carve-out that the same phone number is allowed for different students under different teachers. Tested in `students.int.test.ts`.
5. **The lesson-detail modal opens directly into the student roster view** (instead of the edit form) whenever the lesson already has any registrations. Tested in `tests/e2e/teacher-roster-management.spec.ts` (close and reopen a lesson with a live registration; it lands in roster view with no extra click).
6. **Publishing copies a plain link to the clipboard** rather than generating the Hebrew announcement message text the plan describes. Tested in `registrations.int.test.ts` (`publishWeekAction`) and end-to-end in `tests/e2e/student-registration.spec.ts` (the copied link actually works).
7. **Returning-student recognition is implemented via a long-lived (1 year), per-teacher-scoped signed cookie** (`yr_student_{teacherId}`), not by phone-number lookup with visible autofill. Tested in `tests/e2e/student-registration.spec.ts`.
8. **Deleting a lesson with an active registration throws an unhandled database error** (`ON DELETE RESTRICT` foreign key) instead of failing gracefully. This looks like a latent bug rather than an intentional design choice — flagged for a real fix, not just documentation. Tested in `lessons.int.test.ts`.

---

## Explicitly out of scope (manual / not automated)

| Area | Why it's not automated | How to spot-check manually |
|---|---|---|
| Real WhatsApp message delivery | No WhatsApp integration exists in this MVP at all (see above) — nothing to test. | N/A until Phase 2 automated WhatsApp is built; this plan must be updated at that point per the no-real-WhatsApp-in-tests constraint. |
| Visual/RTL layout polish, dark mode, exact pixel spacing | Automated tests assert on text content, roles, and state transitions, not pixel-perfect layout. | Periodically open the app in both LTR-mental-model review and an actual RTL locale, in light and dark mode, on both a phone-width and desktop-width viewport. |
| Cross-browser/mobile-browser rendering quirks | The e2e suite runs Chromium only, to keep CI fast. | Before a real release, manually click through the golden path (teacher creates + publishes a week, a student registers) in Safari/iOS and at least one other engine. |
| Production HTTPS / cookie `Secure` flag behavior | This bit the team once already (session cookies silently stopped working over plain HTTP in production) and is inherently an infrastructure concern, not app logic — not meaningfully testable by a browser-driven suite that intentionally runs over local HTTP. | After any deploy, manually confirm login persists past a page refresh on the real production HTTPS URL. |
| Prisma migration correctness against a *non-empty* production-shaped database | Tests always start from a freshly migrated, empty database. | Before applying a new migration in production, review it by hand and consider a dry run against a production data snapshot if the change is non-additive. |

---

## CI trade-off: fast subset on every push, full suite on PRs into `main`

The full Playwright suite is small today, but `.github/workflows/ci.yml` is deliberately structured so it doesn't have to stay that way to remain fast:

- **Every push** (and PRs not targeting `main`) runs only the tests tagged `@fast` (`npm run test:e2e:fast`) — currently the core golden-path journeys (lesson creation + week copy, student registration + waitlisting, teacher roster management).
- **Pull requests targeting `main`** run the full e2e suite (`npm run test:e2e`), including slower or more peripheral journeys (e.g. returning-student cookie recognition), as the more thorough gate before code reaches the main branch.
- Unit and integration tests (with coverage thresholds) always run in full, on every push and PR, before e2e even starts — the pipeline is unit → integration → e2e, fail-fast, so a broken unit test never wastes time booting a browser.

This is a conscious trade-off between commit-to-commit feedback speed and thoroughness, not a silently skipped gap — as the suite grows, add new journeys as `@fast` only if they're both cheap and central to the golden path; default new journeys to full-suite-only otherwise.

## Coverage

`npm run test:coverage` enforces minimum coverage thresholds (80% statements/lines/functions, 75% branches) scoped to the business-logic layer only (`src/app/actions/**`, `src/lib/**`, per `vitest.config.ts`). The UI/e2e layer has no numeric coverage bar by design — it's judged by journey coverage (the traceability table above), not line coverage, per the brief.
