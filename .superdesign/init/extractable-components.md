# Extractable Components

No shared layout or primitive components currently exist.

## AttendanceClock

- Source: `src/app/attendance/clock.tsx`
- Category: basic
- Description: Employee clock-in/out and break-control widget.
- Extractable props: none recommended for the current admin dashboard task.
- Hardcoded: button labels, status text, clock layout, Tailwind classes.

## PageLocalHeader

- Source: `src/app/dashboard/page.tsx`
- Category: layout
- Description: Simple dashboard header with page title, email, role, and Clerk user button.
- Extractable props: title (string), email (string), role (string)
- Hardcoded: spacing, white background, border, text hierarchy.

