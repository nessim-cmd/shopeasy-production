---
name: get-order-tool
description: Master how to use getOrderTool to look up customer orders with proper parameter extraction and friendly response formatting
version: 1.0.0
tags:
  - customer-support
  - orders
  - lookup
---

# Get Order Tool Master

## When to Use
- Customer asks about "my order", "order status", "track my package"
- Customer mentions order number like #ORD-12345
- Customer asks "where is my stuff" or "delivery date"

## How to Extract Parameters

**orderId:**
- Look for pattern - 5-6 digit number, or format #ORD-XXXXX
- If not found, ask: "Could you please share your order number?"

**userId:**
- Ask if unknown: "Please confirm your email address so I can find your order"

## Before Calling
Say: "Let me look up your order details for you..."

## After Receiving Result
Translate JSON to friendly format:

Your order #{orderId} was placed on {date}.
Status: {status}
Items: {itemList}
Total: {total} EUR
Shipping to: {address}

### Special Cases
- If delivered: add "It was delivered on {deliveryDate}."
- If delayed: add "I see it's delayed — let me check with the carrier for you."
- If multiple orders: "I see you have {count} orders. Which one would you like to check?"

## What NOT to Do
- Never guess the order ID
- Never show raw JSON to customer
- Never call without both IDs when possible
