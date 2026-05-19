---
title: "xSeek — Stop guessing. Get cited by AI."
description: "How PerplexityBot and Perplexity-User access your site, how to control them, and how to earn answer citations in Perplexity."
url: "https://www.xseek.io/docs/perplexity-user-agents"
---

[Back to documentation](https://www.xseek.io/docs)
## Perplexity user agents,explained.

Perplexity ships two crawlers. Understand what each one does, how to control access, and how to get your content cited in answers.

Perplexity · Official Updated Apr 2026~6 min read 2 user agents

TL;DR

Perplexity uses **PerplexityBot** for indexing and**Perplexity-User** when the AI assistant browses on behalf of a live user. Both are verifiable via the `perplexity.ai` domain in the user-agent string.

## Overview

Perplexity is an answer engine that crawls the web to provide up-to-date cited responses. Two distinct user agents handle two different jobs — one for the search index, one for live user queries.

Knowing which is which matters: blocking the wrong one cuts you out of Perplexity answers entirely.

## How to identify the agents

2 crawler s

Perplexity identifies itself with specific user-agent strings. Verify each through a published IP range.

## How Perplexity accesses your content

3 access pattern s, mapped to the agents above.

1

#### Search index

`PerplexityBot` crawls content to build and refresh the index behind every answer.

2

#### Live browsing

`Perplexity-User` fetches pages in real time when a user asks a current question.

3

#### Verification

Both identify via `perplexity.ai` in the UA and can be verified with reverse DNS.

## Control Perplexity's access

robots.txt

You control each agent independently. Common configurations below.

#### Allow all Perplexity access Recommended

Standard setup if you want to appear in cited answers.

# Allow Perplexity to crawl and cite User-agent:PerplexityBot Allow:/User-agent:Perplexity-User Allow:/

#### Block Perplexity entirely Restrictive

Keeps Perplexity out completely — no index, no citations.

# Block every Perplexity crawler User-agent:PerplexityBot Disallow:/User-agent:Perplexity-User Disallow:/

#### Block sensitive sections only

Keep public content indexable, protect private areas.

# Restrict Perplexity to public content User-agent:PerplexityBot Disallow:/private/Disallow:/members-only/Allow:/

## Optimize content for Perplexity.

Perplexity rewards content that answers fast and cites well. Five things that work.

**Lead with the answer.** Perplexity extracts direct answers — the first 2 sentences of a page should resolve the question.

**Cite your sources.** Outbound citations raise trust signals. Perplexity's model is trained on citation-rich content.

**Structure with semantic HTML.** Proper headings, lists, and tables so the extractor can isolate the relevant chunk.

**Keep it current.** Perplexity prefers recent sources for time-sensitive queries. Freshness matters.

**Use schema markup.**`Article`, `FAQPage`, and

`Dataset` structured data help Perplexity verify what your page is about.

## Track Perplexity visits with xSeek.

### See every Perplexity visit in real time.

Monitor PerplexityBot and Perplexity-User. Track which URLs they hit. See how your content surfaces in Perplexity answers and which queries send traffic back.

[Start free →](https://www.xseek.io/en/login)

## Frequently asked questions

Two: **PerplexityBot/1.0** for web indexing and **Perplexity-User/1.0** for live assistant browsing. Both include `perplexity.ai` in the UA string and can be verified via reverse DNS.

Source: information in this guide is drawn from[Perplexity's official bot documentation](https://docs.perplexity.ai/guides/bots).
