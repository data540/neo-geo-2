---
title: "xSeek — Stop guessing. Get cited by AI."
description: "Three Claude bots, three jobs. How Anthropic's crawlers access your site, how to control them, and how to earn Claude citations."
url: "https://www.xseek.io/docs/claude-user-agents"
---

[Back to documentation](https://www.xseek.io/docs)
## Claude user agents,explained.

Anthropic runs four Claude bots. Understand what each one does, how to control it, and what it takes to get cited in Claude's answers.

Claude · Anthropic Updated May 2026~7 min read 4 user agents

TL;DR

Anthropic runs four Claude bots — **ClaudeBot** for training,**Claude-User** for user-initiated fetches, **Claude-SearchBot**for search indexing, and **claude-code** for the Claude Code CLI. Control each one independently in `robots.txt`.

## Overview

Anthropic's Claude accesses the web through several distinct user agents, each with a different purpose. Understanding them is essential if you want Claude to cite your content — or keep it out of training runs.

The three primary bots are documented in Anthropic's official help center and all respect`robots.txt`.

## How to identify the agents

4 crawler s

Claude identifies itself with specific user-agent strings. Verify each through a published IP range.

## How Claude accesses your content

4 access pattern s, mapped to the agents above.

1

#### Training

`ClaudeBot` collects content that may feed future Claude model training.

2

#### Search

`Claude-SearchBot` indexes content to improve Claude's search answers.

3

#### On-demand

`Claude-User` fetches a URL when a human asks Claude to read it.

4

#### Developer CLI

`claude-code` fetches a URL when a developer runs a Claude Code WebFetch.

!

**Heads up.** You may still see `claude-web` in older logs. It's a legacy identifier — xSeek keeps detecting it for backwards compatibility.

## Control Claude's access

robots.txt

You control each agent independently. Common configurations below.

#### Allow citations · block training Recommended

Stay citable in Claude, stay out of training data.

# Allow Claude search and user fetches, block training User-agent:ClaudeBot Disallow:/User-agent:Claude-SearchBot Allow:/User-agent:Claude-User Allow:/

#### Block all Claude access Restrictive

Keeps Anthropic out of everything — no citations, no training.

# Block every Claude crawler User-agent:ClaudeBot Disallow:/User-agent:Claude-SearchBot Disallow:/User-agent:Claude-User Disallow:/

## Optimize content for Claude.

What actually moves the needle when Claude decides whether to cite you.

**Use clean, semantic HTML.** Headings, lists, tables — so Claude can parse structure without guessing.

**Render content server-side.** Claude-User doesn't execute complex JS for most fetches. If it needs JS to appear, assume it won't be read.

**Answer the question fully.** Claude cites sources that resolve the question, not pages that dance around it.

**Add schema markup.**`Article`, `FAQPage`, and

`HowTo` structured data help Claude verify authority.

**Split training vs search intentionally.** Not every page belongs in both — use per-agent `robots.txt` rules.

## Track Claude visits with xSeek.

### See every Claude visit in real time.

Monitor ClaudeBot, Claude-User, and Claude-SearchBot. See which URLs they hit. Watch how often Claude recommends your content. Get notified when patterns shift.

[Start free →](https://www.xseek.io/en/login)

## Frequently asked questions

Four: **ClaudeBot** (training), **Claude-User** (user-initiated fetches),

**Claude-SearchBot** (search indexing), and **claude-code** (the Claude Code CLI fetching on behalf of a developer). All four are documented by Anthropic and respect

`robots.txt`. You may also see the legacy `claude-web` identifier in older logs.

Source:[Anthropic's official help center article](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)on Claude bots and `robots.txt` controls.
