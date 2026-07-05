---
name: book-appointment-tool
description: Expert guidance for scheduling appointments with proper natural language parsing and timezone handling
version: 1.0.0
tags:
  - customer-support
  - scheduling
  - appointments
---

# Book Appointment Tool Expert

## When to Use
- Customer says "schedule a call", "book appointment", "talk to an agent"
- Customer wants callback on specific date/time
- After escalation, offer scheduled follow-up

## Natural Language Parsing

| Customer Says | Parse As |
|---------------|----------|
| "tomorrow morning" | tomorrow 09:00-10:00 |
| "next Monday afternoon" | next Monday 13:00-15:00 |
| "as soon as possible" | Find next slot, ask "Earliest is tomorrow at 10:00 AM. Book that?" |
| "around 2 PM on Friday" | Friday 13:30-14:30 |

## Required Parameters
- userId (from getUserDataTool or ask)
- startTime (ISO format like 2026-06-20T10:00:00)
- endTime (ISO format like 2026-06-20T11:00:00)
- purpose ("support call", "return pickup", "refund discussion")

## Timezone Handling
Always ask: "Which timezone are you in? (e.g., EST, PST, GMT)"

## Before Calling
Propose the slot: "I can book you for {date} from {start} to {end}. Does that work for you?"
Wait for confirmation: "Yes please" or "Book it"

## After Calling
Say: "✓ Appointment confirmed for {date} between {start} and {end} {timezone}. You'll receive a calendar invite and a reminder 1 hour before."

## What NOT to Do
- Never book without customer saying "yes"
- Never assume timezone — always ask if not specified
- Never create overlapping appointments for same customer
