# Pages

## `/dashboard`

Entry: `src/app/dashboard/page.tsx`

Dependencies:

- `src/app/dashboard/page.tsx`
  - `src/lib/supabase/server.ts`
  - `@supabase/supabase-js`
  - `@clerk/nextjs/server`
  - `@clerk/nextjs`
  - `next/navigation`
- `src/app/layout.tsx`
- `src/app/globals.css`

## `/attendance`

Entry: `src/app/attendance/page.tsx`

Dependencies:

- `src/app/attendance/page.tsx`
  - `src/lib/supabase/server.ts`
  - `@supabase/supabase-js`
  - `src/app/attendance/clock.tsx`
    - `src/app/attendance/actions.ts`
  - `@clerk/nextjs/server`
  - `@clerk/nextjs`
  - `next/navigation`
- `src/app/layout.tsx`
- `src/app/globals.css`

## `/login`

Entry: `src/app/login/page.tsx`

Dependencies:

- `src/app/login/page.tsx`
  - `next/link`
  - `lucide-react`
- `src/app/layout.tsx`
- `src/app/globals.css`

## `/`

Entry: `src/app/page.tsx`

Dependencies:

- `src/app/page.tsx`
  - `next/link`
  - `next/image`
  - `lucide-react`
- `src/app/layout.tsx`
- `src/app/globals.css`

