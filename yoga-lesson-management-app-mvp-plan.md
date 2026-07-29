# Yoga Lesson Management App — MVP Execution Plan

## Business Summary

A yoga teacher currently coordinates her weekly class schedule and student sign-ups manually over WhatsApp. This product replaces that manual coordination with a lightweight web app: the teacher builds a week of lessons (time, duration, capacity, notes), shares the plan with her existing WhatsApp community, and students self-serve their own registration, waitlisting, and cancellation through a link — no login, identified by phone number. The app also tracks class-package credits per student so the teacher can see who owes classes without ever blocking someone from attending.

The system is designed to support multiple independent teachers (each with their own students, lessons, and dashboard), though the first real user is a single working teacher with roughly 50 students, and the plan below sequences delivery so that teacher's core workflow is usable as early as possible.

## Primary Personas

  - **Teacher** — runs the yoga business. Needs to plan lessons, get the week in front of students with minimal effort, see who's coming to what, manage the student list, and track class credits without turning away a student over a billing gap.
  - **Student** — attends classes, sometimes on behalf of a dependent (e.g. a parent registering a child). Needs a near-zero-friction way to see this week's lessons and register or cancel, without creating an account.

## End-to-End User Journey

1.  Teacher logs in and builds the week's lessons, optionally starting from a copy of last week.
2.  Teacher publishes the plan; students receive it via WhatsApp with a link to the sign-up page.
3.  A student taps the link, identifies by phone number (recognized instantly if returning), and selects the lessons she wants.
4.  If a lesson is full, she's placed on a waitlist instead of being turned away; she sees a confirmation of what was booked and her remaining credit balance.
5.  She can return anytime before a configured cutoff to cancel a registration, which frees the spot for the next waitlisted student.
6.  The teacher, throughout the week, checks her dashboard to see who's registered per lesson, manually adjusts rosters or credits as needed, and manages her overall student list.
7.  History (past lessons, past plans, all students including disabled ones) is retained permanently for the teacher's reference.

## MVP Definition

The smallest end-to-end workflow that delivers value: **a teacher can plan and share a week of lessons, and a student can identify herself, register or waitlist for lessons, and cancel later — with the teacher able to see and manually adjust who's registered and what each student's credit balance is.**

This MVP intentionally ships with a **manual WhatsApp send** rather than the fully automated, unofficial WhatsApp-session automation described in the PRD (see Risks & Assumptions for the rationale) — the teacher clicks "generate weekly message," copies it, and sends it herself, exactly as she does today, just without composing it by hand. Full automation (auto-posting, auto-cancellation notices, auto-reminders, auto-waitlist-promotion messages) is Phase 2, once the core registration workflow is validated with real users.

## Feature Breakdown

Single business initiative — **Yoga Lesson Management & Sign-Up Platform** — broken into the epics below.

## Epic Breakdown

### Epic: Teacher Accounts & Multi-Tenant Foundation

**Objective:** Give each teacher her own isolated account, students, lessons, and dashboard. **User Value:** A teacher's data is private and separate from any other teacher using the platform; this is the foundation everything else is built on. **Dependencies:** None — this is the first epic built. **MVP Scope:** Teacher account creation/login; per-teacher data isolation enforced at the data layer. **Phase 2 Scope:** Password reset flow, richer account settings (business name, branding on the sign-up page). **Risks:** Auth method isn't specified in the PRD — see Risks & Assumptions.

### Epic: Weekly Lesson Planning

**Objective:** Let the teacher build out a week of lessons in advance. **User Value:** Replaces ad hoc scheduling with a structured, reusable weekly plan. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation. **MVP Scope:** Create/edit/delete a lesson (title, day/time, duration, max capacity, comment); copy previous week's plan as a starting point. **Phase 2 Scope:** Per-lesson cancellation-cutoff override (MVP uses one global cutoff); richer weekly calendar views. **Risks:** None significant — this is standard CRUD.

### Epic: Publish & Notify Students

**Objective:** Get the week's plan in front of students with minimal manual effort. **User Value:** The teacher stops hand-typing WhatsApp messages; students get a consistent, clear weekly announcement. **Dependencies:** Weekly Lesson Planning. **MVP Scope:** "Generate weekly message" produces the Hebrew announcement text plus the sign-up link, for the teacher to copy and send herself via WhatsApp; same for a lesson-cancellation message (reason included). **Phase 2 Scope:** Full automated sending — persistent unofficial WhatsApp session, auto-post to the community, automated cancellation messages, automated lesson reminders, automated private waitlist-promotion notices, send-failure flagging, auto-add of new students to the community. **Risks:** The Phase 2 automation is against WhatsApp's Terms of Service and carries account-ban risk (explicitly accepted in the PRD) — isolating this from the MVP reduces the risk taken before the core product is validated.

### Epic: Student Identification & Sign-Up

**Objective:** Let a student reach the sign-up page and be recognized without any login. **User Value:** Zero-friction access — a phone number is the only credential needed, ever. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation (a student record belongs to a teacher). **MVP Scope:** Phone-entry landing screen; server-side lookup by phone; new-student form (name mandatory, email optional) when no match is found; returning-student autofill. **Phase 2 Scope:** Saved-dependent quick-pick (registering a second person, e.g. a child, from a remembered list) — MVP supports registering only the identified person. **Risks:** None beyond those covered in Security & Abuse Prevention.

### Epic: Lesson Sign-Up, Waitlist & Cancellation

**Objective:** Let a student book, waitlist, and cancel lessons for the current week. **User Value:** This is the core value exchange of the product — the student gets a seat (or an honest waitlist position) without a back-and-forth with the teacher. **Dependencies:** Weekly Lesson Planning, Student Identification & Sign-Up, Credits & Packages (for balance deduction). **MVP Scope:** View current week's lessons with live capacity; multi-select and submit registration; automatic waitlist when full; confirmation screen showing booked/waitlisted status and credit balance; view own upcoming registrations; cancel before a global cutoff, which refunds any deducted credit and auto-promotes the next waitlisted student. **Phase 2 Scope:** Per-lesson cutoff override; automated WhatsApp notification on waitlist promotion (MVP relies on the student re-checking her "my lessons" view). **Risks:** Waitlist-promotion visibility is weaker without push notification in MVP — flagged as an accepted trade-off, not a defect.

### Epic: Credits & Packages

**Objective:** Track each student's class-credit balance against a package, without ever blocking attendance. **User Value:** Gives the teacher a business-tracking layer (who's paid, who owes) that previously lived only in her head or a notebook. **Dependencies:** Student Roster Management (a student must exist to hold a balance). **MVP Scope:** Teacher defines package types (name, credit count or unlimited); assigns/tops up a student's package; registering an open lesson deducts one credit (waitlisting does not); promotion from waitlist deducts one credit at that moment; cancellation refunds a deducted credit; zero/negative balances are visible but never block registration; teacher can manually edit a balance. **Phase 2 Scope:** Inline quick-credit UI polish (editable number + "+5" shortcut directly in list rows, red styling for zero/negative) — MVP can ship with a simpler "edit balance" action reachable from the student profile only. **Risks:** None significant — logic is fully specified in the PRD.

### Epic: Teacher Dashboard & Lesson Roster

**Objective:** Let the teacher see, at a glance and in detail, who's coming to each lesson. **User Value:** Directly answers the teacher's original ask — "how many students registered for each lesson" — and lets her fix mistakes (add/remove a student) without touching the database. **Dependencies:** Lesson Sign-Up, Waitlist & Cancellation. **MVP Scope:** Weekly view listing each lesson with registered/waitlisted counts; drill-in lesson detail showing the full registered and waitlisted rosters; manually add or remove a student from a lesson (before or after it occurs). **Phase 2 Scope:** Dashboard metric cards (aggregate counts for registrations, waitlist, negative-balance students, failed sends); manual "promote" override button on waitlist rows (MVP relies on automatic promotion only). **Risks:** None significant.

### Epic: Student Roster Management

**Objective:** Let the teacher maintain her full student list directly in the app. **User Value:** One source of truth for student contact info, status, and history — nothing lives in a separate spreadsheet or contacts app. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation. **MVP Scope:** List all students; add a student manually; edit student info; disable/enable (soft delete — history retained, no hard delete ever); view a student's profile including upcoming and past lesson history. **Phase 2 Scope:** Search and status/balance filter chips; "registered family members" chip list on the profile; the day/date/time/status four-column history layout (MVP can ship this as a simpler list — the column formatting is a display refinement, not a data requirement). **Risks:** None significant.

### Epic: Security & Abuse Prevention

**Objective:** Prevent the no-login, freely-forwardable sign-up link from being abused. **User Value:** Protects real students' spots from being consumed by fake or scripted sign-ups, especially now that a zero/negative credit balance never blocks registration. **Dependencies:** Student Identification & Sign-Up (this wraps that endpoint). **MVP Scope:** Rate limiting on sign-up/lookup attempts (by IP and by phone number); server-side phone number format validation; a honeypot field to silently discard basic bot submissions. **Phase 2 / Future Scope:** Lightweight CAPTCHA (e.g. Cloudflare Turnstile); cross-checking the phone number against actual WhatsApp community membership (depends on the Phase 2 WhatsApp automation existing); one-time SMS/WhatsApp verification on first registration. **Risks:** The baseline is intentionally lightweight; revisit if real abuse is observed after launch.

## User Stories

Grouped by Epic, MVP stories first within each, ordered happy path → validation → error handling → edge cases → permissions.

#### Teacher Accounts & Multi-Tenant Foundation — Story: Teacher creates an account and logs in

**Goal:** Give the teacher a private, persistent place to manage her business. **User Story:** As a teacher, I want to create an account and log in, so that my lessons and students are private to me. **Acceptance Criteria:**

  - Given a new teacher, when she signs up with valid credentials, then an account and empty student/lesson data set are created for her.
  - Given an existing teacher, when she logs in with correct credentials, then she reaches her own dashboard and sees only her own data.
  - Given incorrect credentials, when she attempts login, then she sees an error and is not authenticated. **Out of Scope:** Password reset, social login, multi-factor auth. **Dependencies:** None.

#### Teacher Accounts & Multi-Tenant Foundation — Story: Teacher data stays isolated from other teachers

**Goal:** Guarantee privacy/correctness as more than one teacher uses the platform. **User Story:** As a teacher, I want my students and lessons invisible to other teachers, so that my business data stays private. **Acceptance Criteria:**

  - Given two teacher accounts, when either queries lessons or students, then only records belonging to that teacher are returned.
  - Given a direct request for another teacher's lesson or student record by ID, when it's attempted, then access is denied. **Out of Scope:** Cross-teacher collaboration features. **Dependencies:** Teacher creates an account and logs in.

#### Weekly Lesson Planning — Story: Teacher creates a lesson

**Goal:** Let the teacher build her week. **User Story:** As a teacher, I want to add a lesson with title, day/time, duration, capacity, and a comment, so that it appears in this week's plan. **Acceptance Criteria:**

  - Given the weekly plan editor, when the teacher submits a valid lesson form, then the lesson appears in the week's lesson list.
  - Given a missing title or capacity, when she submits, then the form shows a validation error and nothing is saved. **Out of Scope:** Recurring/repeating lesson templates beyond the weekly copy action. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation.

#### Weekly Lesson Planning — Story: Teacher edits or deletes a lesson

**Goal:** Let the teacher correct mistakes or remove a lesson before publishing. **User Story:** As a teacher, I want to edit or delete a lesson I've created, so that the week's plan stays accurate. **Acceptance Criteria:**

  - Given an existing lesson, when the teacher edits any field and saves, then the updated values are reflected in the week's plan.
  - Given a lesson with existing registrations, when the teacher lowers its max capacity below the current registered count, then she sees a warning before saving.
  - Given a lesson, when the teacher deletes it, then it's removed from the plan and any registered students are handled per the cancellation-notification flow (Phase 2 auto-message; MVP: teacher is shown the affected student list to notify manually). **Out of Scope:** Automated cancellation messaging (Phase 2). **Dependencies:** Teacher creates a lesson.

#### Weekly Lesson Planning — Story: Teacher copies last week's plan

**Goal:** Save the teacher from re-entering a recurring schedule every week. **User Story:** As a teacher, I want to copy last week's lessons into the current week, so that I only need to adjust what's changed. **Acceptance Criteria:**

  - Given a previous week with lessons, when the teacher chooses "copy from previous week," then all of that week's lessons are duplicated into the current week as editable drafts.
  - Given no previous week exists, when she attempts to copy, then she sees a clear empty state instead of an error. **Out of Scope:** Copying from any arbitrary past week (MVP only supports "most recent week"). **Dependencies:** Teacher creates a lesson.

#### Publish & Notify Students — Story: Teacher generates the weekly announcement message

**Goal:** Remove the manual effort of writing the weekly WhatsApp message. **User Story:** As a teacher, I want to generate a ready-to-send weekly plan message with a sign-up link, so that I can share it with my students without typing it by hand. **Acceptance Criteria:**

  - Given a week with at least one lesson, when the teacher clicks "generate weekly message," then a Hebrew message listing all lessons plus a working sign-up link is produced and ready to copy.
  - Given a week with no lessons, when she attempts to generate the message, then she's blocked with a clear explanation. **Out of Scope:** Automated sending (Phase 2). **Dependencies:** Weekly Lesson Planning.

#### Publish & Notify Students — Story: Teacher generates a lesson-cancellation message

**Goal:** Give affected students a clear, consistent cancellation notice. **User Story:** As a teacher, I want to generate a cancellation message with my reason, so that I can notify students consistently when I cancel a lesson. **Acceptance Criteria:**

  - Given a lesson being cancelled, when the teacher provides a reason and confirms, then a ready-to-send Hebrew message including the lesson name and reason is produced.
  - Given no reason is entered, when she attempts to confirm, then she's prompted to provide one. **Out of Scope:** Automated sending (Phase 2). **Dependencies:** Weekly Lesson Planning.

#### Student Identification & Sign-Up — Story: Student identifies herself by phone number

**Goal:** Get a student into the sign-up flow with zero account creation friction. **User Story:** As a student, I want to enter my phone number, so that I don't need to create an account to sign up for lessons. **Acceptance Criteria:**

  - Given a phone number that matches an existing student record for this teacher, when submitted, then her saved name/email are loaded automatically.
  - Given a phone number with no match, when submitted, then she's shown a short form to enter her name (mandatory) and email (optional).
  - Given an invalid phone number format, when submitted, then she sees a validation message and cannot proceed. **Out of Scope:** Any password or OTP verification (Future). **Dependencies:** Teacher Accounts & Multi-Tenant Foundation.

#### Lesson Sign-Up, Waitlist & Cancellation — Story: Student views and selects this week's lessons

**Goal:** Let the student see what's available and choose what she wants. **User Story:** As a student, I want to see this week's lessons with live capacity, so that I can choose which ones to attend. **Acceptance Criteria:**

  - Given a published week, when the student reaches the lesson-selection screen, then she sees every lesson's title, day/time, duration, and current capacity status.
  - Given a lesson at max capacity, when displayed, then it's clearly marked as waitlist-only rather than hidden. **Out of Scope:** Filtering/searching lessons (not needed at this scale). **Dependencies:** Student Identification & Sign-Up, Weekly Lesson Planning.

#### Lesson Sign-Up, Waitlist & Cancellation — Story: Student registers for one or more lessons

**Goal:** Complete the core booking action. **User Story:** As a student, I want to select multiple lessons and submit registration in one action, so that I don't have to repeat the process per lesson. **Acceptance Criteria:**

  - Given one or more selected open lessons, when the student submits, then she's registered for each and a credit is deducted per lesson from her balance.
  - Given a selected lesson at max capacity, when she submits, then she's placed on that lesson's waitlist instead, with no credit deducted yet.
  - Given zero or negative remaining credits, when she submits, then registration still succeeds (never blocked). **Out of Scope:** Payment collection (handled offline, out of the app entirely). **Dependencies:** Student views and selects this week's lessons, Credits & Packages.

#### Lesson Sign-Up, Waitlist & Cancellation — Story: Student sees her registration confirmation

**Goal:** Give the student certainty that her booking worked. **User Story:** As a student, I want a confirmation showing what was booked or waitlisted, so that I know exactly where I stand. **Acceptance Criteria:**

  - Given a completed submission, when the confirmation screen loads, then each lesson shows as either "registered" or "on waitlist," alongside her current credit balance.
  - Given a negative or zero balance, when shown on this screen, then it displays as a plain number with no warning styling (warnings are teacher-side only). **Out of Scope:** None. **Dependencies:** Student registers for one or more lessons.

#### Lesson Sign-Up, Waitlist & Cancellation — Story: Student cancels a registration before the cutoff

**Goal:** Let the student free up her spot if her plans change. **User Story:** As a student, I want to cancel a registered lesson before a cutoff, so that my spot can go to someone else and I get my credit back. **Acceptance Criteria:**

  - Given a registration made before the cutoff time, when the student cancels, then the registration is removed, and if a credit was deducted it's refunded to her balance.
  - Given a registration past the cutoff, when she attempts to cancel, then the cancel action is disabled with a clear explanation.
  - Given a cancelled confirmed (non-waitlisted) spot with students on the waitlist, when the cancellation completes, then the next waitlisted student is automatically promoted and a credit is deducted from her balance at that moment. **Out of Scope:** Automated WhatsApp notification of the promotion (Phase 2) — MVP surfaces this only in the promoted student's own "my lessons" view. **Dependencies:** Student registers for one or more lessons.

#### Credits & Packages — Story: Teacher defines a package type

**Goal:** Let the teacher model how she actually sells classes. **User Story:** As a teacher, I want to define package types (e.g. "10-class card," "unlimited monthly"), so that I can assign them to students. **Acceptance Criteria:**

  - Given a new package type with a name and either a credit count or an "unlimited" flag, when saved, then it becomes available to assign to any student. **Out of Scope:** Pricing/payment processing. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation.

#### Credits & Packages — Story: Teacher assigns or tops up a student's package

**Goal:** Give a student her class credits after she's paid offline. **User Story:** As a teacher, I want to assign a package or add credits to a student, so that her balance reflects what she's paid for. **Acceptance Criteria:**

  - Given a student and a package type, when the teacher assigns it, then the student's balance reflects the package's credit count (or is marked unlimited).
  - Given an existing balance, when the teacher manually adds or edits credits, then the new balance is saved and visible immediately. **Out of Scope:** Any in-app payment collection. **Dependencies:** Teacher defines a package type, Student Roster Management.

#### Credits & Packages — Story: Registration and cancellation adjust credit balance correctly

**Goal:** Keep the credit ledger accurate without manual bookkeeping. **User Story:** As a teacher, I want credits to deduct and refund automatically based on registration activity, so that I don't have to track this by hand. **Acceptance Criteria:**

  - Given an unlimited package, when a student registers, then no credit is deducted.
  - Given a limited package, when a student registers for an open lesson, then exactly one credit is deducted; when she's waitlisted, none is deducted until promotion.
  - Given a cancelled confirmed registration, when processed before the cutoff, then the deducted credit is refunded. **Out of Scope:** None — this is core MVP logic. **Dependencies:** Teacher assigns or tops up a student's package, Lesson Sign-Up, Waitlist & Cancellation.

#### Teacher Dashboard & Lesson Roster — Story: Teacher views weekly registration counts

**Goal:** Answer the teacher's original question — how many students per lesson. **User Story:** As a teacher, I want to see registered and waitlisted counts per lesson for the week, so that I know what to expect for each class. **Acceptance Criteria:**

  - Given a week with published lessons and registrations, when the teacher opens her dashboard, then each lesson shows its registered count against capacity and its waitlist count. **Out of Scope:** Aggregate metric cards (Phase 2). **Dependencies:** Lesson Sign-Up, Waitlist & Cancellation.

#### Teacher Dashboard & Lesson Roster — Story: Teacher views and edits a lesson's full roster

**Goal:** Let the teacher see exactly who's coming and fix mistakes. **User Story:** As a teacher, I want to see the full registered and waitlisted list for a lesson and add or remove students myself, so that I can correct the roster when needed. **Acceptance Criteria:**

  - Given a lesson, when the teacher opens its detail view, then she sees every registered and waitlisted student with name, phone, and credit balance.
  - Given a roster, when she manually adds a student to it, then that student is registered (with the same credit-deduction rule as self-registration) even if the lesson is already published.
  - Given a registered student, when she removes them, then the registration is deleted and any deducted credit is refunded. **Out of Scope:** Manual waitlist reordering/promotion (Phase 2). **Dependencies:** Teacher views weekly registration counts.

#### Student Roster Management — Story: Teacher adds a student manually

**Goal:** Let the teacher pre-populate her student list rather than waiting for self-registration. **User Story:** As a teacher, I want to add a student directly, so that I can onboard someone without her needing to sign up herself first. **Acceptance Criteria:**

  - Given a name and phone number, when the teacher adds a student, then the student appears in her roster and can subsequently be recognized if that phone number is used on the sign-up page. **Out of Scope:** Bulk import. **Dependencies:** Teacher Accounts & Multi-Tenant Foundation.

#### Student Roster Management — Story: Teacher disables a student without losing history

**Goal:** Remove someone from active use while keeping records intact. **User Story:** As a teacher, I want to disable a student instead of deleting her, so that her registration history is preserved but she can't register for new lessons. **Acceptance Criteria:**

  - Given an active student, when the teacher disables her, then she no longer appears in active-student lists or is able to complete new registrations, but her past history remains fully visible.
  - Given a disabled student, when the teacher re-enables her, then she can register again. **Out of Scope:** Hard delete (explicitly never offered, per the retain-history requirement). **Dependencies:** Teacher adds a student manually.

#### Student Roster Management — Story: Teacher views a student's upcoming and past lessons

**Goal:** Give the teacher a complete picture of one student's engagement. **User Story:** As a teacher, I want to see a student's upcoming and past lessons in one place, so that I understand her attendance pattern. **Acceptance Criteria:**

  - Given a student profile, when opened, then it lists her upcoming registered/waitlisted lessons and her full past lesson history with status (attended, cancelled). **Out of Scope:** The four-column day/date/time/status display refinement (Phase 2 — MVP can use a simpler list format). **Dependencies:** Teacher adds a student manually, Lesson Sign-Up, Waitlist & Cancellation.

#### Security & Abuse Prevention — Story: Sign-up endpoint resists scripted abuse

**Goal:** Protect real students' spots from bot/script abuse from day one. **User Story:** As a teacher, I want the sign-up page protected against scripted abuse, so that a stranger with the link can't flood my classes with fake registrations. **Acceptance Criteria:**

  - Given repeated sign-up attempts from the same IP or phone number beyond a defined threshold within a short window, when the threshold is exceeded, then further attempts are rejected.
  - Given a malformed phone number, when submitted, then it's rejected both client- and server-side before reaching registration logic.
  - Given a bot that fills in the hidden honeypot field, when it submits, then the request is silently discarded. **Out of Scope:** CAPTCHA, WhatsApp-community cross-check, SMS verification (Future). **Dependencies:** Student Identification & Sign-Up.

## Dependency Graph

graph TD

  A[Teacher Accounts and Multi-Tenant Foundation] --> B[Weekly Lesson Planning]

  A --> C[Student Roster Management]

  B --> D[Publish and Notify Students]

  A --> E[Student Identification and Sign-Up]

  C --> F[Credits and Packages]

  B --> G[Lesson Sign-Up, Waitlist and Cancellation]

  E --> G

  F --> G

  G --> H[Teacher Dashboard and Lesson Roster]

  E --> I[Security and Abuse Prevention]

  C --> J[Student profile history view]

  G --> J

## Recommended Development Sequence

1.  **Teacher Accounts & Multi-Tenant Foundation** — nothing else can be built or demoed without this.
2.  **Weekly Lesson Planning** and **Student Roster Management** in parallel — both only depend on step 1, and together they produce the first demoable screens.
3.  **Credits & Packages** — layers onto the roster; needed before real registrations can deduct/refund correctly.
4.  **Student Identification & Sign-Up** — the other half of the core loop; can start as soon as step 1 is done, in parallel with steps 2–3.
5.  **Lesson Sign-Up, Waitlist & Cancellation** — the heart of the MVP; depends on 2, 3, and 4 all being in place.
6.  **Publish & Notify Students (manual-message version)** — thin layer on top of Weekly Lesson Planning; can be built any time after step 2, but sequenced here since it's only useful once there's a real link to share (step 5 live).
7.  **Teacher Dashboard & Lesson Roster** — depends on real registration data existing (step 5).
8.  **Security & Abuse Prevention** — should land before the sign-up link is ever shared publicly; build alongside or immediately after step 4, and confirm it's in place before step 6 goes live for real students.

This ordering means the team can demo "teacher builds a week and manages students" after step 3, and the full end-to-end MVP loop after step 7 — with security hardening validated before any real public link goes out.

## Risks, Assumptions, and Open Questions

  - **Teacher authentication method is unspecified in the PRD.** Assumed email/password for MVP; confirm before building, since this affects the account-creation story.
  - **Recommended MVP deviation:** the PRD specifies fully automated, unofficial WhatsApp session automation (Baileys/whatsapp-web.js) for publishing and all notifications. This plan defers that to Phase 2 and ships MVP with a manual "generate message, teacher sends it herself" flow instead. Rationale: the automation carries real technical risk (WhatsApp Terms-of-Service violation, account-ban risk, an always-on VPS with a fragile persistent session) that's better taken on after the core registration/credit/waitlist workflow is validated with real users — not before. If the business need is urgent enough that manual sending is unacceptable even for a first release, this sequencing should be revisited with the team.
  - **Global vs. per-lesson cancellation cutoff:** MVP assumes one global cutoff (hours before start) rather than a per-lesson override, per the PRD's "global default" option — confirm this is acceptable for launch.
  - **Waitlist promotion notice in MVP** relies on the student checking her own "my lessons" view rather than a push notification, since that depends on the deferred WhatsApp automation. Worth flagging to the teacher as a real launch-day limitation.
  - **No payment processing in-app at any phase** — confirmed explicitly in the PRD; all money changes hands offline, the app only tracks credit counts.
  - **Security baseline is intentionally minimal for MVP** (rate limiting, phone validation, honeypot). If real abuse is observed post-launch, escalate to the Future-tier options (CAPTCHA, community-membership cross-check, SMS verification) rather than waiting for a major version.
