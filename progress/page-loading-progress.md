# page-loading progress

Status: done.

- Spinner: `components/ui/spinner.tsx` (`Spinner`, `PageSpinner`), keyframes in `app/globals.css`; reduced motion switches rotation to an opacity pulse.
- Instant layer: `components/shared/nav-progress.tsx` (`NavLinkIcon` swaps the icon of the pressed sidebar, bottom-bar and menu item for a spinner; `NavProgressBar` runs along the bottom edge of the top bar; a polite live region announces "Memuat"). Delay 120 ms, minimum 300 ms (`use-delayed-flag.ts`).
- Fallback layer: `loading.tsx` in `app/`, `app/admin`, `app/coach`, `app/member`, `app/superadmin/(portal)`; the spinner fades in after 120 ms.
- Checked on a production build with delayed server responses at 1440 and 375 px: shell nodes keep their identity, `main` does not move, nothing is left behind after the page arrives. With a route loading boundary the fallback shows; without one the nav item spinner and bar show.
