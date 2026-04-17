# Implementation Checklist

Use this reference when planning or implementing features for this repository's attendance-management system.

## Architecture Mapping

Align implementation with `Architecture.md`.

Frontend:

- Admin dashboard: period status, warnings, unconfirmed shifts, export actions.
- Employee shift screen: own confirmed shifts and relevant notes.
- Settings/master screen: workplace, target period, employee flags, calendars, statutory limits.

Backend Logic:

- Shift creation/editing engine: input, duration calculation, confirmation, lock/change workflow.
- Compliance check: employee restrictions, care flags, warning/error output.
- Labor-time calculation engine: day/week/period aggregation.
- Overtime engine: three-pass extraction without double counting.

Database:

- Employee master: attributes, restriction flags, care notes.
- Calendar/statutory-limit master: target periods, start dates, weekly limit, calendar days, total frame.
- Confirmed shift/actual data: planned shifts, confirmation status, actuals, calculation results, audit history.

## Suggested Data Model Areas

Use names that fit the existing codebase, but preserve these concepts:

- workplaces
- employees
- employee_restrictions or employee_attributes
- target_periods
- statutory_limit_snapshots
- shifts
- shift_change_logs
- labor_time_calculations
- overtime_segments
- compliance_warnings
- payroll_exports

Keep snapshots for legal/calculation basis:

- weekly statutory hours used for the period.
- target-period calendar days.
- calculated statutory total frame.
- shift confirmation timestamp.
- calculation version if formulas evolve.

## Acceptance Scenarios

Create tests or seed scenarios for these cases when implementing calculation-heavy behavior:

- 30-day target period with 40-hour basis gives 171.4 hours before display rounding.
- 31-day target period with 40-hour basis.
- 28-day target period with 40-hour basis.
- 44-hour eligible workplace target period.
- Daily overtime where a specified day exceeds 8 scheduled hours.
- Weekly overtime excluding daily-extracted overtime.
- Target-period overtime excluding daily and weekly extracted overtime.
- Employee under 18 receives restriction check.
- Pregnancy/postpartum request flag receives restriction check.
- Childcare/family-care flag produces the configured warning or block.
- Confirmed shift cannot be silently edited.
- Post-confirmation edit records reason, actor, and timestamp.
- Payroll export separates scheduled time, statutory-inside overtime, and statutory-outside overtime.

## Implementation Guardrails

- Before editing Next.js files, follow `AGENTS.md` and read the relevant guide under `node_modules/next/dist/docs/`.
- Keep calculation functions deterministic and unit-testable.
- Avoid mixing UI display rounding with payroll/calculation precision.
- Prefer structured date/time APIs over string parsing.
- Treat timezone and date-boundary behavior as explicit requirements.
- Avoid embedding mutable labor-rule constants deep in UI components.
- Keep warnings explainable in human language and machine-readable codes.

## Documentation Updates

When changing behavior:

- Update `requirement.md` if the product requirement changes.
- Update `Architecture.md` if component boundaries or data flow change.
- Add unresolved legal/payroll assumptions to the open questions section rather than burying them in code comments.
