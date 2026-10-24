# personal-bottom-nav progress

Status: Phase 0 done, Phase 1 next.

- [x] Phase 0: read the shells, nav and the three forms; plan below
- [ ] Phase 1: personal bottom nav, `AppShell` prop, desktop header "+"
- [ ] Phase 2: `QuickAddProvider`, sheet, chooser, background submit
- [ ] Phase 3: remove inline cards, rewire home button, restriction rules

## Plan
- `AppShell` gets `quickAdd?: boolean`: it passes `personal` to `MobileNav`, renders the "+" in the header and the `QuickAddSheet` inside `.app-ui` (so inputs keep the 16px mobile size).
- `PersonalShell` wraps `AppShell` in `QuickAddProvider` (state, background submit, sports and today for the workout form, `canSocial` from `socialRestriction`).
- `MobileNav` `personal` variant: Beranda, Teman, "+", Latihan, Menu; icons only with `aria-label`; the Menu sheet is the existing one.
- Forms: `PostForm`, `FriendAddForm`, `WorkoutForm` become plain forms with `onSubmit` and `pending`; `PhotoPicker` moves to its own file; `post-composer.tsx` goes away.
