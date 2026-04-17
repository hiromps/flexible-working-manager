---
name: japan-attendance-system
description: Build, review, and refine this repository's Japanese attendance and shift-management system for 1-month variable working hours. Use when working on requirement.md, Architecture.md, database schemas, shift screens, labor-time calculations, compliance checks, overtime classification, payroll exports, or implementation plans for Japan-specific attendance rules.
---

# Japan Attendance System

## Core Workflow

Use this skill as the domain guide for this repository's attendance-management product.

1. Read the live project documents first:
   - `requirement.md` for current business requirements.
   - `Architecture.md` for system boundaries and data flow.
   - `AGENTS.md` before writing application code. This repo uses a Next.js version with breaking changes, so read relevant docs under `node_modules/next/dist/docs/` before coding Next.js behavior.
2. Load only the reference file needed for the task:
   - For labor-rule interpretation and calculation checks, read `references/domain-rules.md`.
   - For implementation planning, schema work, API design, or acceptance checks, read `references/implementation-checklist.md`.
3. Keep legal-sensitive conclusions explicit:
   - Treat this skill as implementation guidance, not legal advice.
   - Flag uncertain labor-law assumptions as confirmation items for a social insurance and labor consultant, legal, or payroll owner.
4. Preserve traceability:
   - Tie feature work back to `REQ-###` IDs from `requirement.md`.
   - Keep calculation outputs explainable by employee, day, week, and target period.

## Task Guidance

### Requirements And Architecture

- Keep `requirement.md` as the source of product requirements.
- Keep `Architecture.md` as the source of component boundaries.
- When revising docs, align terms across Frontend, Backend Logic, and Database.
- Add open questions instead of silently deciding ambiguous labor or payroll policy.

### Calculation Logic

- Model calculations in this order:
  1. Shift duration and break deduction.
  2. Daily scheduled/actual working time.
  3. Weekly working time.
  4. Target-period total working time.
  5. Statutory total-frame comparison.
  6. Overtime classification without double counting.
- Preserve intermediate results. Do not only store final totals.
- Make rounding, midnight-crossing shifts, holidays, absences, and corrections explicit policy decisions.

### Compliance Checks

- Separate hard errors from warnings.
- Use hard errors for rules that must block shift confirmation once the business policy is decided.
- Use warnings for care obligations, review prompts, and unresolved policy checks.
- Keep employee attributes and restriction flags auditable.

### Data And UI Design

- Design data around target periods, employees, shifts, calculations, warnings, and audit history.
- Support administrators and employees as separate permission surfaces.
- Do not let confirmed shifts be mutated invisibly. Record reason, actor, and timestamp for changes.
- Prefer master-managed values for labor-rule parameters that may change.

## Output Expectations

When using this skill, produce one or more of:

- Requirement edits with stable `REQ-###` references.
- Architecture or data-flow updates that match existing Mermaid structure.
- Schema/API proposals with calculation traceability.
- Implementation plans grouped by screen, backend engine, and database table.
- Test scenarios for legal-frame limits, overtime tiers, employee restrictions, and payroll exports.
- Explicit unresolved questions for business/legal confirmation.

