# Routes

Framework: Next.js App Router.

CSS approach: Tailwind CSS v4 via `@tailwindcss/postcss`.

Component library: custom page-local components plus `lucide-react` icons and Clerk auth UI.

## Route Map

| URL | File | Layout | Summary |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | `src/app/layout.tsx` | Landing page with marketing sections and login links |
| `/login` | `src/app/login/page.tsx` | `src/app/layout.tsx` | Role selection page for employee/admin login |
| `/dashboard` | `src/app/dashboard/page.tsx` | `src/app/layout.tsx` | Admin dashboard placeholder, Clerk auth, profile bootstrap |
| `/attendance` | `src/app/attendance/page.tsx` | `src/app/layout.tsx` | Employee time clock page |
| `/sign-in/[[...sign-in]]` | `src/app/sign-in/[[...sign-in]]/page.tsx` | `src/app/layout.tsx` | Clerk sign-in page |
| `/sign-up/[[...sign-up]]` | `src/app/sign-up/[[...sign-up]]/page.tsx` | `src/app/layout.tsx` | Clerk sign-up page |
| `/auth/callback` | `src/app/auth/callback/route.ts` | route handler | Auth callback |
| `/auth/signout` | `src/app/auth/signout/route.ts` | route handler | Sign out |
| `/api/webhooks/clerk` | `src/app/api/webhooks/clerk/route.ts` | route handler | Clerk webhook |

