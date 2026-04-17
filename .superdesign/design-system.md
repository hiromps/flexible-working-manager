# Design System

## Product Context

MINORU勤怠 is a Japanese attendance and shift-management app. The admin dashboard must help administrators confirm target-period status, detect statutory-limit issues, review compliance warnings, confirm shifts, rerun calculations, and export shift/payroll data.

## Visual Direction

- Use a clear operations-console layout.
- Prioritize legibility, warning hierarchy, and dense but calm information display.
- Keep the interface professional and trustworthy for payroll and labor-compliance work.
- Avoid decorative gradients, floating blobs, and one-note color themes.

## Colors

- Primary: `#0457a7`
- Secondary: `#005a96`
- Accent: `#e4c057`
- Error: `#e73858`
- Success: `#047857`
- Warning: `#b45309`
- Info background: `#eff6ff`
- Warning background: `#fffbeb`
- Error background: `#fff1f2`
- Surface: `#ffffff`
- Page background: `#f8fafc`
- Border: `#e5e7eb`
- Text primary: `#111827`
- Text secondary: `#4b5563`
- Text muted: `#6b7280`

## Typography

- Use the existing Next font variables and sans-serif stack.
- Do not scale font sizes with viewport width.
- Letter spacing must be `0` unless using tiny uppercase labels already established in the app.
- Keep Japanese labels concise and operational.

## Layout

- Admin pages use a full-width application shell, not a marketing hero.
- Use responsive grids with stable card dimensions.
- Use individual cards for repeated metrics and lists only.
- Do not put cards inside cards.
- Use border radius `8px` or less for buttons and cards where possible.
- Main dashboard content should start immediately with period status and action controls.

## Components

- Buttons: rounded `8px`, strong contrast, stable padding.
- Cards: white surface, subtle border, small shadow only when needed.
- Alerts: include severity, target employee/period, and action hint.
- Tables/lists: keep row heights stable and readable on mobile.
- Status badges: use compact text with background color, not icons alone.

## Admin Dashboard Requirements

- Show target period, start/end dates, 40/44-hour basis, statutory total frame, and confirmation status.
- Show key metrics: employees, unconfirmed shifts, statutory-frame warnings, compliance warnings, payroll export readiness.
- Show warning queues for REQ-007 and REQ-009.
- Show action area for REQ-008, REQ-011, and REQ-012.
- Include calculation traceability hints for day/week/period aggregation.
