**REVERTED by WO-234** — Cindy: this session is not #1. Do not keep self-deploy.

# WO-233 DONE — Rule: deploy staging yourself; give Cindy a test list

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  

## Symptom (Cindy)

“Change the rule — just go to staging and tell me what I need to test.” Stop leaving work as queued for #1.

## Surfaces

| Surface | This WO |
|---------|---------|
| `.cursor/rules/*` + CLAUDE.md + two skills | **Yes** |
| Studio product code | **No** |

## Change

Staging hosting: the session that finishes a WO deploys it, then chats a numbered test list (URL, Ctrl+Shift+R, orange banner, clicks). Git commit/push still #1. Production still typed GO.

## Verify

This is process, not a Studio screen. Next product WO should land on staging without a “queued for #1” closer.
