# ONCall Flagging Strategy

## Overview
Determining when and how to set flags on the cases table so the A-Team can push them to the CDL via Kafka consumer. Some flags are straightforward, such as Cancelled Billable and Haas Alert, while others require more involved logic to determine when they should be set and by what process.

## Example Flag Payload

The following example shows one reasonable target shape for a derived flag object. Some fields are simple booleans, some return supporting metadata, and some still depend on source-system gaps or production rollout status.

```json
{
  "FLAG": {
    "Digital_Initiated": {
      "email": "maestro-create@nodomain.com",
      "user_name": "Maestro Integration: Create"
    },
    "Auto-Dispatch": true,
    "Time-Out - Non-Digital Event": true,
    "Dealer Decline - Non-Digital Event": true,
    "No Answer - Non-Digital Event": [],
    "Full Success - Digital Event": false,
    "Not Used - Non-Digital Event": false,
    "Fully Digital Event": false,
    "Dealer Roll-Over": false,
    "Haas Alert": true,
    "Duplicate Events": false,
    "Cancelled Billable": false
  }
}
```

Notes on this structure:
- `Digital_Initiated` is shown as an object because the originating integration identity may be more useful than a bare boolean.
- `Auto-Dispatch`, `Time-Out - Non-Digital Event`, `Dealer Decline - Non-Digital Event`, `Haas Alert`, `Duplicate Events`, and `Cancelled Billable` are natural boolean flags.
- `No Answer - Non-Digital Event` may need to be represented as an array or object if the downstream consumer needs the supporting response details.
- `Full Success - Digital Event` should be false if the case timed out, was declined, or resulted in no answer.
- `Not Used - Non-Digital Event` can be treated as the inverse of `Auto-Dispatch` if that matches the final business rule, though the existing audit-log query is more precise because it checks for human interaction.
- `Fully Digital Event` can only be true when both `Digital_Initiated` and `Auto-Dispatch` are true and there is no human intervention.
- `Dealer Roll-Over` depends on inbound program mapping against the dealer IPN list.
- `Duplicate Events` depends on the `cases.duplicated` field being available in production.

## General Event Flags

### Digitally Initiated / Mode of Event Initiation
Purpose: Understand how events originate, especially whether they were initiated electronically and by which customer. This helps quantify event origin channels and justify future feature development and support.

Definition:
- A case is digitally initiated if the creating user has a non-null `api_token`.
- Otherwise, the case was created by an Eagle agent.

Source tables:
- `cases`
- `users`

Logic:
- Join `cases.created_by_id` to `users.id`
- If `users.api_token IS NOT NULL`, treat the case as electronically initiated

Example query:
```sql
WITH api_users AS (
  SELECT id, email, user_name
  FROM users
  WHERE api_token IS NOT NULL
)
SELECT a.case_number, api_users.*
FROM cases a
INNER JOIN api_users ON a.created_by_id = api_users.id
WHERE a.case_number = 'F033670'
```

### Auto-Dispatch
Purpose: Determine whether auto-dispatch was used and capture the auto-dispatch action breakdown for each incident. Dealer information is also needed for troubleshooting and dealer follow-up or incentive programs.

Source tables:
- `cases`
- `audit_logs`
- `users`

Logic:
- Identify cases where all audit activity came from API users or the MTVA system user

Known system user:
- `0d2a3680-664f-4124-a7dd-554d0eddd581`

Example query:
```sql
SELECT DISTINCT c.case_number, c.id
FROM cases c
JOIN audit_logs al ON al.case_id = c.id
JOIN users u ON u.id = al.actor_id
WHERE c.case_number = '{CASENUMBER}'
GROUP BY c.id, c.case_number
HAVING COUNT(*) = COUNT(
  CASE
    WHEN u.api_token IS NOT NULL
      OR u.id IN ('0d2a3680-664f-4124-a7dd-554d0eddd581')
    THEN 1
    ELSE NULL
  END
)
```

### Full Success - Digital Event
Purpose: Identify digitally initiated events that remained fully digital through closure.

Current interpretation:
- The case was never assigned to anyone outside the MTVA or API-driven flow before it closed.

Source tables:
- `cases`
- `audit_logs`
- `users`

Status:
- Logic is still somewhat uncertain and likely depends on validating audit log behavior.

Rule constraints:
- Should not be true if the event timed out
- Should not be true if the dealer declined
- Should not be true if the dealer response was no answer

Example query:
```sql
SELECT DISTINCT c.case_number, c.id
FROM cases c
JOIN audit_logs al ON al.case_id = c.id
JOIN users u ON u.id = al.actor_id
WHERE c.case_number = 'F053356'
GROUP BY c.id, c.case_number
HAVING COUNT(*) = COUNT(
  CASE
    WHEN u.api_token IS NOT NULL
      OR u.id IN ('0d2a3680-664f-4124-a7dd-554d0eddd581')
    THEN 1
    ELSE NULL
  END
)
```

### Time-Out - Non-Digital Event
Purpose: Identify cases where the auto-dispatch timer expired.

Source table:
- `case_autodispatch_timers`

CDL status:
- Not currently replicated to CDL

Example query:
```sql
SELECT c.case_number, cat.id
FROM cases c
INNER JOIN case_autodispatch_timers cat ON c.id = cat.case_id
WHERE c.case_number = 'F065208'
  AND cat.timer_status = 'timed_out'
```

### Dealer Decline - Non-Digital Event
Purpose: Identify cases where the dealer declined during the auto-dispatch flow.

Source table:
- `case_autodispatch_timers`

CDL status:
- Not currently published to CDL

Example query:
```sql
SELECT c.case_number, cat.id
FROM cases c
INNER JOIN case_autodispatch_timers cat ON c.id = cat.case_id
WHERE c.case_number = 'F065385'
  AND cat.timer_status = 'declined'
```

### No Answer - Non-Digital Event
Purpose: Identify cases where the dispatch attempt completed but the dealer response reason was no answer.

Source tables:
- `case_autodispatch_timers`
- `dealers_response`

CDL status:
- Only one of these tables is currently published to CDL

Example query:
```sql
SELECT c.case_number, b.accepted, b.reason, b.note, b.phone_number
FROM cases c
INNER JOIN case_autodispatch_timers cat ON c.id = cat.case_id
INNER JOIN dealers_response b ON cat.case_id = b.case_id
WHERE c.case_number = 'F047207'
  AND cat.timer_status = 'accepted'
  AND b.reason = 'No answer'
```

### Not Used - Non-Digital Event
Purpose: Identify cases where a human agent touched the case, meaning the event was not fully handled through the digital or automated path.

Source tables:
- `cases`
- `audit_logs`
- `users`

Logic:
- Look for audit activity by non-API users excluding the MTVA system user
- In a simplified downstream model, this may be treated as true when `Auto-Dispatch` is false
- The audit-log-based approach is still preferable if the goal is to explicitly detect human intervention

Example query:
```sql
SELECT DISTINCT c.case_number, c.id
FROM cases c
JOIN audit_logs al ON al.case_id = c.id
JOIN users u ON u.id = al.actor_id
WHERE c.case_number = 'F107798'
  AND u.api_token IS NULL
  AND u.id NOT IN ('0d2a3680-664f-4124-a7dd-554d0eddd581')
GROUP BY c.id, c.case_number
```

### Number of Phone Calls During Event
Purpose: Count inbound and outbound phone calls between Eagle and the customer during the event, from dispatch through case completion.

Source table:
- `case_calls`

CDL status:
- Not yet replicated to the data lake
- Tracked as part of Fixpix Pipeline: FXP PL

Example query:
```sql
SELECT
  case_calls.case_id,
  cases.case_number,
  SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound,
  SUM(CASE WHEN direction = 'inbound' THEN 0 ELSE 1 END) AS outbound
FROM case_calls
INNER JOIN cases ON case_calls.case_id = cases.id
WHERE cases.case_number = 'F047207'
GROUP BY case_calls.case_id, cases.case_number
```

### Fully Digital Event
Purpose: Identify events that were digitally initiated, dispatched, and completed without any human dispatch-team interaction.

Definition:
- Digitally initiated
- Auto-dispatched
- No human interaction
- Cannot be true if dealer declined or timed out
- Cannot be true if dealer response was no answer

Note:
- This currently appears to be the same as an auto-dispatch full success case.
- The query must account for the fake MTVA agent ONCall creates when using the API-token-based user with GraphQL.

Source tables:
- `cases`
- `audit_logs`
- `users`

Example query:
```sql
SELECT DISTINCT c.case_number, c.id
FROM cases c
JOIN audit_logs al ON al.case_id = c.id
JOIN users u ON u.id = al.actor_id
WHERE c.case_number = 'F053356'
GROUP BY c.id, c.case_number
HAVING COUNT(*) = COUNT(
  CASE
    WHEN u.api_token IS NOT NULL
      OR u.id IN ('0d2a3680-664f-4124-a7dd-554d0eddd581')
    THEN 1
    ELSE NULL
  END
)
```

## Marketing-Focused Flags and Labels

### Dealer Roll-Over
Purpose: Highlight calls that came from after-hours dealer lines.

Source:
- `cases.inbound_program`
- `dealer_inbound_program_numbers.csv`

Constraint:
- The inbound program data that identifies whether an IPN is a dealer line lives in ERS Profile, not ONCall's database.

Implication:
- This requires cross-system mapping and may not be fully derivable from ONCall data alone.

### Haas Alert
Purpose: Flag whether fleet geo-location was validated through ESD, API, or driver text validation so a Haas Safety Alert can be passed along.

Source field:
- `cases.location_validated_by_driver_app`

Open question:
- Confirm whether this field is currently going to CDL.

### Future Features
Potential future flags or labels:
- Batched
- Delayed/Next Day

## Operations-Focused Flags and Labels

### Case Modification
Purpose: Track how many times a case was modified after closure and identify who made those changes.

Source tables:
- `case_status_changes`
- `cases`
- `users`

Constraint:
- This likely requires more complex audit-style logic and may not map cleanly to a simple flag on the `cases` table.

Example query:
```sql
WITH cases_closed_multiple_times AS (
  SELECT
    a.case_id,
    b.case_number
  FROM case_status_changes a
  INNER JOIN cases b ON a.case_id = b.id
  WHERE b.case_number = 'F040011'
    AND a.new_status = 'closed'
  GROUP BY a.case_id, b.case_number
  HAVING COUNT(*) > 1
)
SELECT
  c.case_id,
  c.case_number,
  d.*, 
  e.email
FROM cases_closed_multiple_times c
INNER JOIN case_status_changes d ON c.case_id = d.case_id
INNER JOIN users e ON d.user_id = e.id
WHERE e.api_token IS NULL
  AND d.timestamp >= '2026-01-01'
  AND d.old_status = 'closed'
```

### Duplicate Events
Purpose: Track each time the duplicate alert was triggered.

Source field:
- `cases.duplicated`

Status:
- Added in lower environments
- Not yet released to production
- Expected in an upcoming sprint

Example query:
```sql
SELECT duplicated
FROM cases
WHERE case_number = 'F107812'
```

## Billing-Focused Flags and Labels

### Cancelled Billable
Purpose: Track calls that were cancelled and still billable.

Source fields:
- `cases.billable`
- `cases.status`

Logic:
- True when `billable = true` and `status IN ('closed_canceled', 'canceled')`

Example query:
```sql
SELECT
  CASE
    WHEN billable AND status IN ('closed_canceled', 'canceled') THEN true
    ELSE false
  END AS cancelled_billable
FROM cases
WHERE case_number = 'F107812'
```

## Summary Table: Flag Implementation Status

| Flag | Category | Data Source | CDL Status | Implementation Notes |
| --- | --- | --- | --- | --- |
| Digitally Initiated | General | `users`, `cases` | Ready | Based on `users.api_token` via `cases.created_by_id` |
| Auto-Dispatch | General | `audit_logs`, `users`, `cases` | Ready | Audit activity must come only from API users or MTVA system user |
| Full Success - Digital Event | General | `audit_logs`, `users`, `cases` | Tentative | Logic likely valid but still needs confirmation |
| Time-Out - Non-Digital Event | General | `case_autodispatch_timers` | Not replicated | Not currently available in CDL |
| Dealer Decline - Non-Digital Event | General | `case_autodispatch_timers` | Not published | Not currently available in CDL |
| No Answer - Non-Digital Event | General | `case_autodispatch_timers`, `dealers_response` | Partial | Only part of the required data is currently published |
| Not Used - Non-Digital Event | General | `audit_logs`, `users`, `cases` | Ready | Detects human touch on the case |
| Number of Phone Calls During Event | General | `case_calls`, `cases` | Not replicated | Depends on data lake / Fixpix pipeline work |
| Fully Digital Event | General | `audit_logs`, `users`, `cases` | Ready | Same logic as full success digital event for now |
| Dealer Roll-Over | Marketing | `cases.inbound_program`, ERS Profile CSV | Pending | Requires cross-system mapping |
| Haas Alert | Marketing | `cases.location_validated_by_driver_app` | Unknown | Need to confirm CDL publication |
| Case Modification | Operations | `case_status_changes`, `users`, `cases` | Unknown | Requires more complex logic than a simple case flag |
| Duplicate Events | Operations | `cases.duplicated` | Planned | Field exists in lower env, not yet in production |
| Cancelled Billable | Billing | `cases` | Ready | Directly derived from `billable` and `status` |
