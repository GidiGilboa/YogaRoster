# Build Prompt: Yoga Lesson Management App

Copy everything below into Claude Code (or Claude) to build the application.

-----

## Prompt

Build a web application for managing yoga lesson scheduling and student sign-ups. The system supports multiple teachers, each managing their own students and lessons independently.

### Users & Roles

**Teacher**

  - Creates/edits a weekly lesson plan in advance: each lesson has title, date & time, duration, max number of students, and a comment field.
  - Can copy an entire week's plan from the previous week as a starting point, then edit it.
  - Publishes the weekly plan with one click, directly from the app: the app automatically sends a single WhatsApp message (Hebrew, including the lesson list and a link to the student sign-up web page) to the shared WhatsApp community. No copy/paste by the teacher, and no need to message students one by one.
  - Can cancel an individual lesson at any time, providing a reason. The app automatically sends a single WhatsApp cancellation message (including the lesson name and reason) to the same community. No copy/paste by the teacher.
  - When a waitlisted student is auto-promoted (see below), the app automatically sends that specific student a private WhatsApp notification (this one case stays 1:1, since a community broadcast isn't meaningful to a single individual's promotion).
  - Has a dashboard showing, per week and per lesson: number registered, number waitlisted, the full list of registered/waitlisted students, whether the community post for that week/cancellation succeeded, and which individual waitlist-promotion notifications failed to send (see Send failures below).
  - Can manually add or remove any student from any lesson, before or after the lesson has occurred.
  - Can view, per student, their full history of past lessons and their upcoming registered lessons.
  - Fully manages the student roster in-app: add student, disable/enable student (soft delete — keep history, block future registration), edit student info. All student data lives in the application (no external list).
  - Configures a per-lesson (or global default) cancellation cutoff: number of hours before lesson start after which students can no longer self-cancel.
  - Works from both desktop and mobile browsers — the app must be fully responsive.
  - Manages class packages/credits per student (see Payments & Packages below): sells/assigns a package, sees remaining balance, and can manually adjust it (e.g. for a discount or correction).

### Payments & Class Packages

  - Each student has a credit balance tied to a package (e.g. "10-class card," "5-class card," "unlimited monthly"). The teacher creates package types (name, number of credits or unlimited, optional validity period) and assigns/renews them per student.
  - Registering for a lesson deducts one credit from the student's balance (unlimited packages simply don't deduct). If a student has no credits remaining, they cannot register and see a clear "no credits left" message with an instruction to contact the teacher.
  - Cancelling a registration (within the allowed cutoff) refunds the credit back to the student's balance. A no-show is not tracked separately in this version, so a credit is only lost if the student doesn't cancel in time per the existing cutoff rule — there's no separate no-show penalty logic beyond that.
  - The teacher's dashboard shows each student's current package and remaining balance, and lets her top up or adjust it manually. Actual money changing hands (cash, bank transfer, etc.) happens outside the app — the app only tracks credits, not payment processing.
  - Only the teacher can add or remove credits from a student's balance. Students cannot self-adjust, self-request, or purchase credits in-app — a brand-new student's first package must be assigned by the teacher (typically after she's arranged payment offline) before that student can successfully register for a lesson.

### WhatsApp Sending (automated, unofficial)

  - **Default channel — the community:** the weekly plan and lesson cancellations are each sent as a single message to the shared WhatsApp community (not one-by-one to each student). This mirrors how the teacher already runs things (one community, all students/parents as members) but removes the manual copy/paste step — the app posts the message automatically when the teacher clicks "Publish" or "Cancel lesson."
  - **Exception — waitlist promotion:** this is the one message type sent privately to a single student, since it only concerns that individual and doesn't belong in a broadcast to the whole community.
  - This is implemented via unofficial WhatsApp automation (e.g. a library such as whatsapp-web.js or Baileys) that drives a WhatsApp session linked to the teacher's own WhatsApp account, rather than the official WhatsApp Business API. The same linked session is used both to post to the community and to send the individual waitlist-promotion message.
  - **One-time setup:** the teacher links her WhatsApp account to the app once by scanning a QR code (the same mechanism as WhatsApp Web/Linked Devices). Thanks to WhatsApp's multi-device support, once linked, the session stays active on the server independently of whether her phone or WhatsApp Web is open at the moment of sending — she does not need to keep anything open for messages to go out.
  - The app runs on an always-on server so the linked session persists and messages can be sent (publish/cancel actions) at any time, from any device the teacher uses to access the app.
  - The teacher's linked WhatsApp account must already be a member of the target community for the automation to be able to post into it.
  - **Important, explicitly accepted risk:** this approach is against WhatsApp's Terms of Service and carries a real risk that WhatsApp detects the automation and temporarily or permanently restricts/bans the linked number. The teacher has accepted this risk. Consider isolating this to a secondary number if that risk becomes a concern later.
  - **Rate limiting:** even though most sends are now single messages (to the community), still add a small delay before any automated send as a general precaution against triggering WhatsApp's automation detection.
  - **Send failures:** if a message fails to send (community post or individual waitlist notification), there is no automatic retry — it's simply flagged as "not sent" in the teacher's dashboard so she can follow up manually.
  - **Adding a new student to the community:** when the teacher adds a new student in the app, the app attempts to add them directly to the WhatsApp community via automation. WhatsApp's own privacy settings ("who can add me to groups") may block direct adds for some users — if that happens, the app instead generates a community invite link and marks the student as "pending — needs to join manually" in the dashboard, so the teacher knows to share the link with them (e.g. in the same first WhatsApp message, or however she prefers) until they've joined.
  - **Lesson reminders:** the app automatically sends a reminder message shortly before each lesson starts (e.g. a few hours ahead, configurable) to the students registered for it. Since this is specific to who's registered for that particular lesson, it is sent as private messages to those individual students rather than a community broadcast.

**Student**

  - Reaches the sign-up page via the link in the teacher's WhatsApp message — no login/password required.
  - Identifies by phone number. Name and phone are mandatory on first use; email is optional. This info is remembered (autofilled) for future visits, keyed by phone number.
  - Can register themselves and/or additional people under their own visit (e.g., a parent registering a child) — each registered person has their own name/phone/email. Previously registered dependents (e.g. a child registered before) are remembered and offered as a quick pick on future visits, so the parent doesn't retype their info every time.
  - Sees the current week's lessons, can select any number of lessons, and submits registration in one action.
  - If a lesson is at max capacity, the student is placed on a waitlist instead of being blocked; if a registered student cancels, the next person on the waitlist is automatically promoted and should be notified.
  - Can view their own list of upcoming registered/waitlisted lessons and cancel from any lesson, but only until the configured cutoff (X hours before the lesson starts) — after that, self-cancellation is disabled. Past lesson history is not shown to students in this version — only upcoming/current registrations.
  - After submitting a registration, sees a confirmation screen showing which lessons were successfully booked (or waitlisted) and her remaining credit balance after the deduction.

### System / Data Requirements

  - Multi-tenant: the system supports multiple teachers, each with an isolated set of students, lessons, and dashboards.
  - Full history is retained permanently: every registration/cancellation/waitlist event, every past weekly plan, and the complete student list (including disabled students).
  - Core entities: Teacher, Student (per teacher, keyed by phone, with a linked Package/credit balance), Package (type, credit count or unlimited flag, validity period, assigned student), Weekly Plan (a collection of Lessons for a given week, with publish timestamp and generated message), Lesson (title, datetime, duration, max capacity, comment, status incl. cancelled), Registration (links a student to a lesson; status: registered / waitlisted / cancelled / attended; records whether a credit was deducted/refunded).
  - UI and all generated WhatsApp messages are in Hebrew, right-to-left layout.

### Non-functional / Implementation Notes

  - No official WhatsApp Business API — WhatsApp sending is fully automated in-app via unofficial browser/session automation linked to the teacher's own number (see WhatsApp Sending section above). No copy/paste step anywhere in the teacher's flow.
  - The app must work well on both desktop and mobile browsers (responsive design), for both the teacher's dashboard/management screens and the student sign-up page.
  - Recommend a simple, modern, low-maintenance stack suited to a small app (e.g., a Node.js-based web framework, since the WhatsApp automation library is Node-based, with a lightweight relational database), unless you have a preferred stack — pick one and justify briefly.
  - Design the data model so per-teacher isolation and full historical retention (per the requirements above) are straightforward to implement and query.
  - Flag clearly in the implementation that the unofficial WhatsApp automation is inherently fragile (WhatsApp can change behavior or block sessions without notice) and that this is a known, accepted trade-off in exchange for avoiding official API costs/approval.

### What This Requires to Run (no paid/official APIs)

  - No WhatsApp Business API, no payment processor (money is handled offline), and no SMS/OTP service — all deliberately avoided.
  - An always-on host is required: because the WhatsApp session must stay persistently connected, this cannot run on typical serverless/free-tier hosting that spins down. A small always-on VPS or cloud instance (e.g. Hetzner, DigitalOcean, Railway — roughly $5–10/month) is sufficient at this scale.
  - A real phone number with WhatsApp installed, linked once via QR code (the teacher's own number, or a dedicated secondary one per the earlier ban-risk discussion) — not a purchased service.
  - Database and reminder scheduling run inside the same server process (e.g. embedded SQLite or a local Postgres instance) — no separate managed database service is required at this scale.
  - A custom domain for the sign-up link is optional/nice-to-have (~$10–15/year); a free subdomain from the hosting provider works fine otherwise.
  - **Not compatible with edge/serverless platforms:** Cloudflare Pages/Workers, Vercel, Netlify Functions, and similar edge-function platforms cannot host the WhatsApp automation piece — they run short-lived, stateless functions (no persistent Node.js process, no filesystem, no headless browser support), whereas the WhatsApp session needs a continuously-running process. These platforms could only serve the static student-facing frontend, if desired; the backend (API, database, WhatsApp session) still needs a traditional always-on VPS. Simplest approach: run everything together on one small VPS rather than splitting the architecture.

*Prepared from a requirements discussion — see conversation for full context.*
