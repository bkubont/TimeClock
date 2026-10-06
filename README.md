# SquareThisUp Time Clock

Private, mobile-first workday clock for one owner. Clock in once, change locations and add notes during the day, clock out once.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Prisma + SQLite
- Auth.js credentials (one-time owner registration, then locked)

## Setup

```bash
cd /agent/time-clock
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm start` — serve production build
