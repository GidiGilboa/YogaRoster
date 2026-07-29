# Yoga Roster

[![CI](https://github.com/GidiGilboa/YogaRoster/actions/workflows/ci.yml/badge.svg)](https://github.com/GidiGilboa/YogaRoster/actions/workflows/ci.yml)

A Hebrew/RTL yoga lesson management app: teachers plan weekly lessons and manage a student roster with class credits; students self-serve registration, waitlisting, and cancellation via a shared link — no login required. Built with [Next.js](https://nextjs.org) (bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)), Prisma, and SQLite.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

The test suite has three layers — see [`qa-test-plan.md`](./qa-test-plan.md) for full story-to-test traceability, what's intentionally not automated, and known gaps between the product plan and the current implementation.

```bash
npm run test:unit          # pure utility functions, no I/O
npm run test:integration   # server actions against an ephemeral SQLite DB per test file
npm run test:coverage      # unit + integration with coverage thresholds enforced
npm run test:e2e           # full Playwright journey suite
npm run test:e2e:fast      # tagged @fast smoke subset (what runs on every push)
```

Every test file gets its own throwaway database — nothing here ever touches real data, and there's no manual cleanup step.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
