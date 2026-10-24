# personal-bottom-nav progress

Status: Phase 1 done, Phase 2 next.

- [x] Phase 0: read the shells, nav and the three forms; plan below
- [x] Phase 1: personal bottom nav, `AppShell` prop, desktop header "+"
- [ ] Phase 2: `QuickAddProvider`, sheet, chooser, background submit
- [ ] Phase 3: remove inline cards, rewire home button, restriction rules

## Plan
- `AppShell` gets `quickAdd?: boolean`: it passes `personal` to `MobileNav`, renders the "+" in the header and the `QuickAddSheet` inside `.app-ui` (so inputs keep the 16px mobile size).
- `PersonalShell` wraps `AppShell` in `QuickAddProvider` (state, background submit, sports and today for the workout form, `canSocial` from `socialRestriction`).
- `MobileNav` `personal` variant: Beranda, Teman, "+", Latihan, Menu; icons only with `aria-label`; the Menu sheet is the existing one.
- Forms: `PostForm`, `FriendAddForm`, `WorkoutForm` become plain forms with `onSubmit` and `pending`; `PhotoPicker` moves to its own file; `post-composer.tsx` goes away.

## Phase 1
Files: `components/shared/mobile-nav.tsx` (personal variant), `components/shared/app-shell.tsx` (`quickAdd` prop, header button), `components/personal/quick-add.tsx` (context, provider, `QuickAddButton`, `QuickAddTrigger`). Check: `next typegen` + `tsc --noEmit` clean. The bar is not wired in `PersonalShell` yet (Phase 2).
