# Authentication & Onboarding

_Last updated: 2026-06-05_

World Cup Fantasy uses **Supabase Auth** through `@supabase/ssr`, so sessions
work in Server Components, Route Handlers, and middleware. The app runs under
the Next.js `basePath` `/worldcup2026`, which matters for every redirect URL.

## Pieces

| File | Role |
|------|------|
| `src/lib/supabase.ts` | Browser client (`createBrowserClient`). |
| `src/lib/supabase-server.ts` | Server client (`createServerClient`, `getAll`/`setAll` cookies) + admin (service-role) client. |
| `src/middleware.ts` | Refreshes the session cookie on every request and enforces route guards. |
| `src/app/auth/login/page.tsx` | Magic link (default) + password sign-in / sign-up. |
| `src/app/auth/callback/route.ts` | Exchanges the OTP `code` for a session, then routes to onboarding or `/today`. |
| `src/app/auth/onboarding/` | First-run username claim + optional password. |
| `src/components/AccountMenu.tsx` | Mobile header sign-out (desktop uses `SideNav`). |

## Flow

1. **Guest** hits `/` (hero) and taps **Play for free → `/auth/login`**.
2. **Magic link** (default): email → Supabase sends a link to
   `<origin>/worldcup2026/auth/callback`. Password sign-up is also available.
3. **Callback** runs `exchangeCodeForSession(code)`. If the user's
   `user_metadata.onboarded !== true` → `/auth/onboarding`, else → `/today`.
   A failed/expired exchange → `/auth/login?error=link`.
4. **Onboarding** writes `username` + `display_name` to `profiles`, sets
   `profiles.onboarded = true`, optionally sets a password, and mirrors
   `onboarded: true` into `user_metadata` (so middleware stops redirecting).
5. **Session persistence**: middleware calls `getUser()` on every request,
   which rotates and re-sets the auth cookie — the user stays logged in across
   reloads and navigation.
6. **Logout** (`AccountMenu` / `SideNav`) calls `signOut()` → `/`.

## Route guards (`middleware.ts`)

- Public: `/`, `/auth/**`, `/join/**`.
- Unauthenticated on a protected route → `/auth/login`.
- Authenticated but `onboarded !== true` → `/auth/onboarding`.
- The `onboarded` check reads the JWT (`user_metadata`), so it adds no DB query.

## Database (project `vgguaeutmljgvxdcfmkd`)

Migration **`auth_onboarding_flow`** applied:

- `profiles.onboarded boolean not null default false`.
- RLS on `profiles`: `SELECT` (public), `UPDATE` (`auth.uid() = id`),
  and a new `INSERT` (`with check auth.uid() = id`) for self-healing.
- `handle_new_user()` trigger is now **collision-safe**: it sanitizes the
  desired username and appends an incrementing suffix until unique, so a
  duplicate email-prefix can no longer break signup.
- Existing users were backfilled (`onboarded = true` in both `profiles` and
  `auth.users.raw_user_meta_data`) so they skip onboarding.

## ⚠️ Required Supabase dashboard config

Auth redirect URLs are **not** managed by code/migrations — set them once in
**Authentication → URL Configuration**:

- **Site URL**: the deployed origin (e.g. `https://<your-domain>`).
- **Redirect URLs**: add `<origin>/worldcup2026/auth/callback`
  (and `http://localhost:3000/worldcup2026/auth/callback` for local dev).
- For password sign-up, leave **Confirm email** on (links route through the
  same callback). To skip email confirmation in dev, toggle it off.

## Verification status

The end-to-end flow was reasoned through and each file verified complete on
disk. A full `next build` / `tsc` could **not** be run in this session: the
sandbox's mounted view of the repo intermittently returned truncated/NUL-padded
copies of source files (including untouched ones), which produces phantom parse
errors. The real working-tree files are intact. Re-run `npm run build` locally
to confirm before deploying.

### Manual test checklist

- [ ] Guest sees "Play for free" on `/`.
- [ ] `/auth/login` sends a magic link; the link logs you in.
- [ ] First login lands on `/auth/onboarding`; username saves; redirects to `/today`.
- [ ] Reload `/today` — still logged in.
- [ ] Sign out → `/`.
- [ ] Visit `/picks` while logged out → `/auth/login`.
- [ ] Duplicate username at onboarding shows "That username is taken."
