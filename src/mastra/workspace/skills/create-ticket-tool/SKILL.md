---
name: create-ticket-tool
description: Professional ticket creation with priority mapping, duplicate detection, and comprehensive descriptions
version: 1.0.0
tags:
  - customer-support
  - tickets
  - escalation
---

# Create Ticket Tool Standard

## When to Use
- Customer says "open a ticket", "create a case", "log this issue", "file a complaint"
- After escalation (verify ticket was created)
- Issue requires tracking but can be resolved later
- Issue cannot be resolved in current conversation

## Priority Mapping (CRITICAL)

| Priority | Trigger Phrases | SLA |
|----------|----------------|-----|
| high | "payment fraud", "account hacked", "never got package", "14 days late", "credit card charged wrong" | 2 hours |
| medium | "wrong item", "damaged", "delayed 5 days", "refund not received" | 24 hours |
| low | "how do I", "question about", "return request", "feature suggestion", "feedback" | 48 hours |

## Duplicate Detection
Before creating - check if ticket exists for same order/issue in last 24 hours:
- If yes, say: "You already have an open ticket #{ticketId}. Our team is working on it."

## Parameter Extraction

subject: Max 50 characters, e.g. "Refund for damaged item #ORD-12345"

description: Include this exact format:
Customer: {customerName} (ID: {userId})
Issue type: {refund/return/shipping/account/other}
Order ID: {orderId if any}
What customer wants: {direct quote or summary}
What I tried: {tools called, results received}
Recommended action: {refund/escalate/schedule/etc}

## Before Calling
Say: "I'll create a support ticket so our team can track this issue. Let me summarize what you've told me..."

## After Calling (receives ticketId)
Say:
✓ I've created ticket #{ticketId} for this issue.
Our {priority} priority team will respond within {SLA}.

You'll receive an email confirmation. Reply to that email to add more information.

## What NOT to Do
- Never create tickets for simple questions you can answer with tools
- Never create duplicate tickets — always check first
- Never use "high" priority unless truly urgent (customer angry ≠ urgent)
- Never skip the description — incomplete tickets frustrate human agents
