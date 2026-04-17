# Domain Rules

Use this reference for Japan-specific attendance and shift-management reasoning in this repository.

## Source Of Truth

Read the current `requirement.md` before relying on this summary. If this file and `requirement.md` differ, treat `requirement.md` as newer and update this reference.

## Core Concepts

- The system supports a 1-month variable working-hours arrangement.
- A target period must be within one month.
- The target period has a start date, end date, and calendar-day count.
- The workplace statutory weekly limit is normally 40 hours.
- A special eligible workplace may use 44 hours.
- Scheduled working days and working hours should be identified before the target period begins.
- Confirmed shifts should not be freely changed by the company without traceable reason and history.

## Statutory Total Frame

Calculate the target-period statutory frame from calendar days:

```text
statutory_total_frame = statutory_weekly_hours * calendar_days / 7
```

Example:

```text
40 * 30 / 7 = 171.4 hours
```

Implementation notes:

- Decide and document decimal precision and rounding rules.
- Store the raw calculated value and any displayed rounded value separately if payroll or reports require precision.
- Keep the selected 40/44-hour basis tied to the target period, not only to the workplace's current setting.

## Overtime Classification

Apply overtime extraction in three passes and avoid double counting:

1. Daily pass:
   - If a day has a pre-specified working time over 8 hours, extract time beyond that specified time.
   - Otherwise extract time beyond 8 hours.

2. Weekly pass:
   - If a week has a pre-specified working time over 40 or 44 hours, extract time beyond that specified time.
   - Otherwise extract time beyond 40 or 44 hours.
   - Exclude time already extracted by the daily pass.

3. Target-period pass:
   - Extract time beyond the statutory total frame.
   - Exclude time already extracted by daily and weekly passes.

Implementation notes:

- Persist each pass result separately.
- Keep links from overtime segments back to the source shifts and aggregation window.
- Define how partial weeks at the start/end of a target period are grouped.

## Employee Restrictions And Care

Track employee-level flags needed for compliance checks:

- Whether the employee is covered by the variable working-hours arrangement.
- Whether the employee is under 18.
- Whether pregnancy/postpartum restrictions apply because the employee requested them.
- Whether childcare, family care, or similar care obligations require consideration.

Recommended behavior:

- Show blocking errors for confirmed policy violations.
- Show warnings for review-required care considerations when business policy does not define an automatic block.
- Keep the registration source and timing for sensitive flags auditable.

## Known Policy Decisions

Do not hide these behind code defaults:

- Eligibility criteria for 44-hour workplaces.
- Who may register pregnancy/postpartum request flags and when.
- Whether childcare/family-care considerations block confirmation or only warn.
- Post-confirmation change workflow and approval role.
- Rounding unit for labor time and payroll exports.
- Break deduction rules.
- Midnight-crossing shift treatment.
- Absence, lateness, early leave, paid leave, and holiday treatment.
- CSV/API format expected by payroll systems.

