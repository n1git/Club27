# personal-bottom-nav progress

Status: all phases done.

- [x] Phase 0: read the shells, nav and the three forms; plan below
- [x] Phase 1: personal bottom nav, `AppShell` prop, desktop header "+"
- [x] Phase 2: `QuickAddProvider`, sheet, chooser, background submit
- [x] Phase 3: remove inline cards, rewire home button, restriction rules

## Plan
- `AppShell` gets `quickAdd?: boolean`: it passes `personal` to `MobileNav`, renders the "+" in the header and the `QuickAddSheet` inside `.app-ui` (so inputs keep the 16px mobile size).
- `PersonalShell` wraps `AppShell` in `QuickAddProvider` (state, background submit, sports and today for the workout form, `canSocial` from `socialRestriction`).
- `MobileNav` `personal` variant: Beranda, Teman, "+", Latihan, Menu; icons only with `aria-label`; the Menu sheet is the existing one.
- Forms: `PostForm`, `FriendAddForm`, `WorkoutForm` become plain forms with `onSubmit` and `pending`; `PhotoPicker` moves to its own file; `post-composer.tsx` goes away.

## Phase 1
Files: `components/shared/mobile-nav.tsx` (personal variant), `components/shared/app-shell.tsx` (`quickAdd` prop, header button), `components/personal/quick-add.tsx` (context, provider, `QuickAddButton`, `QuickAddTrigger`). Check: `next typegen` + `tsc --noEmit` clean. The bar is not wired in `PersonalShell` yet (Phase 2).

## Phase 2
Files: `components/personal/quick-add.tsx` (provider with background submit, pending and form keys), `components/personal/quick-add-sheet.tsx`, `components/social/photo-picker.tsx`, `post-form.tsx`, `friend-add-form.tsx`, `components/workouts/workout-form.tsx`, `personal-shell.tsx`, `app-shell.tsx`. `post-composer.tsx` removed. The sheet lives inside `.app-ui` so inputs are 16px. `/` hides the global toaster, so the provider mounts one there. Success refreshes the router (the workout action only revalidates `/workouts`).

## Phase 3
Inline add cards removed from home, friends and workouts; the home "Catat latihan" button opens the workout sheet. Restricted accounts (minor or banned) get a four-slot bar and open the workout sheet directly (no chooser with one choice).

## Checks
`next typegen` + `tsc --noEmit` clean; lint 0 errors. Browser run on a production build at 375 px and 1280 px: 5 icon slots without text, aria-labels, 56px targets, aria-current, Grup only in Menu, "+" per page and chooser on `/groups`, sheet closes at once, loading then success toast (checked with a 2 s delayed request), post and workout appear without reload, failed friend request reopens the sheet with the value, desktop header "+", restricted account.
