---
name: search-web-tool
description: Smart web searching with query optimization and source verification for customer support
version: 1.0.0
tags:
  - customer-support
  - search
  - web
---

# Search Web Tool Guide

## When to Use
- Tracking link broken: search "[carrier] tracking status [code]"
- Customer asks about shipping delays: search "[city] shipping delay [month] 2026"
- Store hours: search "ShopEasy [city] store hours"
- Return policy: search "ShopEasy return policy"
- Factual questions not in your knowledge base

## How to Craft Search Queries (Critical!)
- Keep under 10 words
- Use exact brand names: "ShopEasy" not "the store"
- Never search for: emails, order numbers, addresses, phone numbers

## URL Filtering Rules
Prefer: shopeasy.com, ups.com, fedex.com, dhl.com, usps.com
Avoid: random blogs, forums, links without HTTPS

## Before Searching
Say: "Let me search for that information online for you..."

## After Receiving Result
Format response:

I found information from {source}:
→ {key finding}

Based on this, {recommendation or answer}

### Example
I found information from UPS.com:
→ 'Weather Delay - delivery rescheduled to next day'

Based on this, your package should arrive tomorrow. I'll check again in the morning.

## What NOT to Do
- Never search for customer PII (personal identifiable information)
- Never trust the first result without checking the source domain
- Never search for internal order data — use getOrderTool instead
