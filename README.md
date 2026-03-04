# Wahlu CRM

Company-first outreach CRM built with Next.js 16, TypeScript, Tailwind, and MongoDB.

## Current feature set
- Basic auth gate (password + signed HTTP-only JWT cookie)
- Company CRUD with structured intelligence fields
- First-class People model linked to companies
- Company timeline activities
- Search + filters + server-side pagination
- Follow-up center (overdue + due-today + done/snooze/reschedule)

## Core data model
### Company
- `name`, `website`, `industry`
- `status`, `priority`, `source`
- `tags[]`, `notes`
- socials: `instagramHandle`, `instagramUrl`, `facebookUrl`, `linkedinUrl`, `xUrl`, `tiktokUrl`, `youtubeUrl`
- `addresses[]`, `phones[]`, `emails[]`
- `assignedTo`
- `lastTouchAt`, `nextFollowUpAt`, timestamps

### Person
- `companyId`
- `fullName`, `role`
- `phones[]`, `emails[]`
- socials: `linkedinUrl`, `instagramHandle`, `instagramUrl`
- confidence metadata: `confidenceScore`, `confidenceSource`, `confidenceNotes`
- `notes`, `isPrimaryContact`, timestamps

## API
- `GET/POST /api/companies`
- `GET/PATCH/DELETE /api/companies/:id`
- `GET/POST /api/companies/:id/people`
- `GET/POST /api/companies/:id/activities`
- `GET/POST /api/people`
- `GET/PATCH/DELETE /api/people/:id`
- `GET/POST /api/follow-ups`

## Pagination contract
For list endpoints (`/api/companies`, `/api/people`, `/api/companies/:id/people`):
- query params: `page`, `pageSize`, optional `q`, filters
- response metadata: `total`, `page`, `pageSize`, `totalPages`

Search is DB-level first, then paginated.

## Migration (clean rename from leads → companies)
Run once in production after deploy:
```bash
npm run migrate:leads-to-companies -- --threshold=0.85
```

What it does:
1. Renames Mongo collection `leads` → `companies` (if needed)
2. Migrates `activities.leadId` → `activities.companyId`
3. Normalizes company shape fields
4. Backfills primary people with confidence-based rules
5. Uncertain matches are preserved in company notes as `[unverified-contact]`

## Rollback notes
- Snapshot DB before migration.
- If rollback needed: restore snapshot and redeploy previous app revision.
- Migration is additive/transformative but not designed for automatic reverse transform.

## Setup
```bash
cp .env.example .env.local
npm install
npm run dev
```
Open `http://localhost:3000`.
