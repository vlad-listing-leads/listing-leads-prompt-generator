# UI Layout — App Rail + Header Tabs

Shared layout pattern for all Listing Leads tools (ZMA, Magic Buyer, Cannon Ball).

## Layout

```
┌──────┬─────────────────────────────────────────────────┐
│      │  [Tabs]  ···spacer···  ⚡18/25  🌙  Plan  👤   │
│ Rail ├─────────────────────────────────────────────────┤
│(60px)│                                                 │
│      │              Page Content (scrollable)          │
│      │                                                 │
└──────┴─────────────────────────────────────────────────┘
```

Single header row. No separate tab bar. No sidebar.

---

## 1. App Rail

**Width:** `w-[60px]`, **Background:** `bg-zinc-50 dark:bg-zinc-900`, **Border:** `border-r border-border`

### Logo (top)
- `h-14`, centered, no bottom border
- Image: `size-7` (28px)
- Assets: `/logo-collapsed.svg` (light), `/logo-collapsed-dark-mode.svg` (dark)
- Links to: `https://www.listingleads.com/plan` (same tab)

### App icons (middle)
- Container: `flex-1 flex flex-col items-center pt-3 gap-1`
- Each item: `w-[52px] py-2 rounded-lg`
- Icon: `h-5 w-5` (20px), Lucide
- Label: `text-[9px] font-medium mt-1 leading-tight text-center`
- Active: `bg-accent text-foreground`
- Inactive: `text-muted-foreground hover:bg-accent hover:text-foreground`
- All links open in **same tab** (no target="_blank")

| App | Lucide Icon | URL |
|-----|------------|-----|
| ZMA | `Radar` | `/contacts` (internal, active when on ZMA) |
| Magic Buyer | `MapPinHouse` | `https://magic-buyer-letter.listingleads.com/` |
| Cannon Ball | `Flame` | `#` (placeholder) |

**To adapt:** Set `active: true` on whichever app the current tool is. Change internal href to that tool's landing route.

### Admin toggle (bottom, admin users only)
- `pb-3`, same sizing as app icons
- Icon: `Shield` from Lucide, `h-5 w-5`
- Label: "Admin" when on app pages, "Back" when on `/admin/*`
- Clicking swaps between `/admin/dashboard` and the app's main route
- Uses `useUserRole()` hook — hidden for non-admins

---

## 2. Header

**Height:** `h-14` (56px), `border-b border-border`, `bg-background`
**Padding:** `px-4 sm:px-6`, `gap-4`

### Elements left to right:

1. **NavTabs** (inline) — see section 3
2. **Spacer** — `flex-1`
3. **Weekly allowance** — `hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground`
   - `Zap` icon: `h-3.5 w-3.5`, `text-amber-500` (or `text-red-500` when 0)
   - Count: `font-semibold text-foreground tabular-nums` (or `text-red-600` when 0)
   - Format: `{remaining} / {limit} left this week`
4. **Theme toggle** — `p-2 rounded-lg`, `Sun`/`Moon` icons `w-5 h-5`
   - `text-muted-foreground hover:text-foreground hover:bg-accent`
5. **Plan badge** — `hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium`
   - Light: `bg-purple-100 text-purple-700`
   - Dark: `bg-purple-900/30 text-purple-300`
6. **User menu** (dropdown)
   - Avatar: `h-8 w-8 rounded-full object-cover` (from LL profile headshot)
   - Fallback: `h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-medium` with initial
   - Name: `text-sm font-medium`, `hidden sm:block` — uses LL first_name, falls back to email prefix
   - Trigger: `px-3 py-1.5 rounded-lg hover:bg-accent`
   - Dropdown: `w-56`, align `end`
     - Header: name (`text-sm font-medium`) + email (`text-xs text-muted-foreground`)
     - Account Settings — external link to `listingleads.com/settings`, icon `Settings mr-2 h-4 w-4`
     - Log out — `text-red-600`, icon `LogOut mr-2 h-4 w-4`

---

## 3. NavTabs (inline in header)

Renders inside the `<header>` as the first element, before the spacer.

### Tab item
- `px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap`
- Icon: `h-4 w-4`, `gap-1.5` from label
- Active: `bg-accent text-foreground`
- Inactive: `text-muted-foreground hover:bg-accent/50 hover:text-foreground`

### Tab sets
Switches based on `pathname.startsWith('/admin')`:

**Main tabs (per tool — customize these):**

| Tab | Icon | Route |
|-----|------|-------|
| Contacts | `Users` | `/contacts` |
| Ready | `Zap` | `/zma/ready` |
| Completed | `CheckCircle2` | `/zma/completed` |

**Admin tabs (shared across tools):**

| Tab | Icon | Route |
|-----|------|-------|
| Overview | `BarChart3` | `/admin/dashboard` |
| Users | `Users` | `/admin/users` |
| Batches | `SlidersHorizontal` | `/admin/batches` |
| Skills | `Sparkles` | `/admin/sms-skills` |
| Leaderboard | `Trophy` | `/admin/leaderboard` |
| Plans | `Shield` | `/admin/plans` |

---

## 4. Page Content

- `flex-1 overflow-y-auto bg-background`
- Inner: `max-w-7xl mx-auto p-4 sm:p-6 md:p-8`

---

## 5. Plan Gate (unauthenticated plan)

Shows instead of `children` when user's plan doesn't include access:
- Centered card: `min-h-[60vh]`, `max-w-md text-center space-y-4`
- Lock icon: `h-14 w-14 rounded-full bg-purple-100 dark:bg-purple-900/30`, `Lock h-7 w-7 text-purple-600 dark:text-purple-400`
- CTA button: `rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700`
- Gate logic waits for both `allowedPlanIds` AND `profileData` to load before evaluating (prevents flash)

---

## 6. To Replicate in Magic Buyer (or another tool)

### Files to copy
1. `src/components/app-rail.tsx` — change `active: true` to Magic Buyer entry
2. `src/components/nav-tabs.tsx` — replace `mainTabs` array with Magic Buyer's navigation
3. Dashboard layout pattern from `src/app/(dashboard)/layout.tsx`:
   ```
   <div className="flex h-screen overflow-hidden">
     <AppRail />
     <div className="flex flex-col flex-1 min-w-0">
       <header>
         <NavTabs />
         <spacer />
         ...header items...
       </header>
       <div className="flex-1 overflow-y-auto bg-background">
         {children}
       </div>
     </div>
   </div>
   ```

### Assets needed
- `/public/logo-collapsed.svg`
- `/public/logo-collapsed-dark-mode.svg`

### Dependencies
- `lucide-react` (Radar, MapPinHouse, Flame, Shield + tab icons)
- `next-themes` (dark mode)
- `@/lib/utils` (`cn` helper — clsx + tailwind-merge)
- `@/hooks/use-user-role` (admin check)
- Tailwind with same theme tokens (bg-background, bg-accent, border-border, text-foreground, text-muted-foreground)

### What to customize per tool
- `apps` array in app-rail: set `active: true` for current tool
- `mainTabs` array in nav-tabs: tool-specific pages
- Admin `"back"` route in app-rail: point to tool's landing page
- Header items (allowance, plan badge) if different per tool
- Plan gate logic if plan checking differs
