# WO-037 DONE · Client Portal Updates list — gift-like magazine cards · CR Jul 13

**State:** DONE-UNVERIFIED (staging)  
**Staging:** https://cch-platform-staging.web.app  
**Cache bust:** `cch-progress-updates.js?v=20260713pu9`

## Shipped

### List redesign (`cpPuRenderList`)
- Replaced `.cp-bwu-list-row` thumbnail rows with full-width `.cp-bwu-gift-card` magazine covers
- ~44% landscape cover (`heroImageUrl`) with navy veil + "Your Bi-Weekly Update" kicker
- Playfair period headline, gold uppercase subtitle (`title`), one-line teaser (`highlight.heading` or first line of `greetingBody`)
- "Open the issue →" gold CTA; whole card navigates via `puNav`
- Studio admin: Draft badge + Edit button with `puOnclickAttr` + `stopPropagation`

### Styles (`puInjectStyles`)
- `.cp-bwu-gift-list` / `.cp-bwu-gift-card` — 1px gold hairline between cards, gold border on hover, no shadows, radius 0
- Mobile (`max-width:720px`): image stacks above text

### Helpers
- `puListTeaser(u)` — teaser from highlight or greeting
- `puGiftCoverHtml(heroUrl)` — cover + veil + kicker markup

## Verify (Cowork / Cindy)
1. Client portal → project → Updates tab — large gift cards, real cover images, period + teaser visible
2. Click card → opens update detail; admin Edit opens editor modal (no "Unexpected end of input")
3. Narrow viewport — cover stacks above body
4. Missing `heroImageUrl` — navy gradient placeholder, no broken layout

## Production
Pending Cindy GO — `firebase deploy --only hosting:platform --project cch-design-boards`
