---
name: send-email-tool
description: Professional email sending with templates for refunds, orders, escalations, welcome, and returns
version: 1.0.0
tags:
  - customer-support
  - email
  - notifications
---

# Send Email Tool Pro

## When to Use
- Customer says "email me", "send confirmation", "notify me"
- After completing refund, return scheduling, or ticket creation
- Customer asks for receipt, order summary, or escalation notice

## Email Templates

### Refund Done
Subject: "Refund complete for order #{orderId}"
Body: "Dear {name}, We've processed your refund of {amount} EUR. It will appear in 5-7 business days. Order: {orderId}. Reason: {reason}"

### Order Summary
Subject: "Your ShopEasy order #{orderId}"
Body: "Dear {name}, Order placed: {date}. Items: {items}. Total: {total} EUR. Track here: {trackingUrl}"

### Escalation
Subject: "Support ticket #{ticketId} created"
Body: "Dear {name}, We've escalated your issue. Ticket #{ticketId}. Response within 4 hours."

### Welcome
Subject: "Welcome to ShopEasy!"
Body: "Dear {name}, Thanks for joining! Your account is ready."

### Return Pickup
Subject: "Return pickup scheduled for {date}"
Body: "Dear {name}, Your return pickup for order #{orderId} is scheduled on {date} between {start}-{end}. Have items unpacked and ready."

## How to Extract Parameters
- customerEmail: Get from getUserDataTool first, or ask "What email should I send this to?"
- customerName: Use from profile, or "Valued Customer"

## Before Calling
Confirm: "I'll send a confirmation to {email}. Is that correct?"

## After Calling
Say: "Email sent to {email}. You should see it in a few minutes. Check spam if missing."

## What NOT to Do
- Never send without customer confirming email
- Never include full credit card numbers
- Always CC support@shopeasy.com for audit trail
