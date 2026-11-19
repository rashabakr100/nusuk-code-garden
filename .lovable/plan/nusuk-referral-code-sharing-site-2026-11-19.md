# Nusuk referral code sharing site

## What you get
- One public page (works great on phones) where anyone can post a Nusuk referral code. No sign-up needed.
- Anyone can post as many codes as they like. Every code is visible to everyone.
- The newest codes appear at the top.
- Tap a code once and it copies, with a short "Copied" message.
- After you copy a code, it stays on the list but turns green, and tapping it no longer copies it. You can still select the text and copy it yourself.
- The green "already copied" mark is saved on your phone or computer, so each visitor sees their own green codes. Other visitors still see that code as normal and can copy it.
- Simple protection: empty codes, very long text and the exact same code posted twice are blocked.

## Design
- Calm, warm look inspired by pilgrimage: sand and deep green colors, a clear Arabic and English heading, big tap-friendly code cards.

## Technical details
- Enable Lovable Cloud. Table `referral_codes` (id, code text unique, created_at) with grants and RLS: anon/authenticated can SELECT and INSERT only, with a length check.
- `src/routes/index.tsx`: form to add codes + list loaded with React Query; live updates through realtime.
- Copied IDs stored in localStorage (read after the page loads); copied cards use `select-text` and skip the copy handler.
- Sonner toast for feedback; page title and description set for Nusuk.
