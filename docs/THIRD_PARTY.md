# Third-party sources

Reference repository: https://github.com/mabdullah356/the-current, commit `7d11e64`.

The source repository has no LICENSE file; its README states MIT. Because of that, only layout and markup ideas were taken. Nothing was copied: every file below was written from scratch in Ruzz tokens (`bg-card`, `text-foreground`, `accent`, light and dark), with Ruzz data code, and the reference is hardcoded dark.

| Ruzz file | Source file | Source commit | What was adapted |
|---|---|---|---|
| `components/social/story-ring.tsx` | `Components/Stories.tsx` | `7d11e64` | ring made of a gradient border, an inner gap and the avatar |
| `components/personal/stories-bar.tsx` | `Components/Stories.tsx` | `7d11e64` | horizontal bar of rings with a name under each |
| `components/personal/home-stories.tsx` (skeleton) | `Components/Stories.tsx` | `7d11e64` | loading shape: five circles with a short label |
| `components/personal/story-viewer.tsx` | `Components/Stories.tsx` | `7d11e64` | full-screen viewer shell: media, avatar and name at the top left, close at the top right |
| `components/social/post-card.tsx` | `Components/Post.tsx` | `7d11e64` | header row, media, action row, likes line and caption order |
| `components/social/post-skeleton.tsx` | `Components/Post.tsx` | `7d11e64` | loading shape that follows the post layout |
| `components/social/post-comments-sheet.tsx` | `Components/Comment.tsx` | `7d11e64` | comment row: avatar, bold name with text, small meta line |
| `components/personal/inbox-list.tsx` | `app/(main)/messages/page.tsx` | `7d11e64` | inbox row: avatar, name, preview line |
| `components/personal/chat-thread.tsx` | `app/(main)/messages/chat/[id]/page.tsx` | `7d11e64` | header with back and avatar, bubbles on two sides, composer at the bottom |

Not taken from the reference: Mongoose models, `app/api/*`, authentication, image hosting, its toast provider, the desktop navbar, the message model, the chat API and reels.
