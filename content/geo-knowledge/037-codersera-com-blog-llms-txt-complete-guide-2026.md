---
title: "llms.txt Explained (2026): Spec, Adoption, How to Ship One"
description: "Honest llms.txt guide: the spec, adoption reality (300k-domain study), Stripe/Anthropic examples, robots.txt + AI-bot User-Agent comparison, copy-pasteable template."
url: "https://codersera.com/blog/llms-txt-complete-guide-2026/"
publishedTime: "2026-05-09T07:53:08.000Z"
---

_Updated May 2026 — covers the September 2024 proposal, the May 2026 adoption reality, real annotated examples from Anthropic, Stripe, Cursor, and Cloudflare, and a copy-pasteable template you can ship today._

`llms.txt` is a proposed standard for telling large language models which parts of your site to read. It's a Markdown file at the root of your domain — `https://example.com/llms.txt` — that links to your most important content with one-line descriptions. The proposal arrived in September 2024; by May 2026 most of the SEO and devtools industry has an opinion on it. This guide is the one without the marketing varnish: what the spec actually says, what adoption actually looks like (server-log data included), why you should ship one anyway, and exactly how to do it.

## TL;DR

*   **What it is:** a Markdown file at `/llms.txt` with a curated list of links to your highest-value content.
*   **Who proposed it:** Jeremy Howard (Answer.AI / FastAI), September 3, 2024.
*   **Who's using it:** Anthropic, Stripe, Cursor, Cloudflare, Vercel, Mintlify, Supabase, LangGraph, and ~10% of websites overall.
*   **Who's _fetching_ it:** not the major LLMs. OpenAI, Google, and Anthropic crawlers don't request it in any meaningful volume. GPTBot occasionally does. IDE agents (Cursor, Continue, Cline) and some MCP integrations _do_ use it.
*   **Does it improve your AI citations?** Not measurably, per a 300,000-domain study by SERanking (November 2025).
*   **Should you ship one anyway?** Yes. Cost is near-zero, optionality is real, and the workflow forces you to write a clean inventory of what you'd _want_ AI to cite.
*   **What works today instead:** a deliberate `robots.txt` with explicit User-Agent rules for GPTBot, ChatGPT-User, ClaudeBot, Google-Extended, PerplexityBot, and friends.

## What is llms.txt?

The proposal, published at [llmstxt.org](https://llmstxt.org/?ref=codersera.com), addresses a real problem: LLM context windows are still smaller than most websites, and HTML pages are full of navigation, ads, and JavaScript that don't help a model understand your content. `llms.txt` is the proposed fix — a clean Markdown file that tells the model "here's the high-signal stuff, here are clean Markdown versions of the pages, here's how to find what you need."

Unlike `robots.txt` (which restricts what crawlers can fetch) or `sitemap.xml` (which enumerates every URL for indexing), `llms.txt` is a **curated map**. Think of it as the table of contents you'd hand a smart intern on day one — the canonical pages, the API reference, the policies, in priority order, with a one-line gloss on each link.

## The spec, in plain English

The full spec is short. The **only required element** is an H1 with the project or site name. Everything else is optional, but follows a fixed order:

```
# Project Name

> A blockquote with a one- or two-sentence summary that captures the project.

Optional paragraphs or bullet lists with more detail.

## Section name

- [Link title](https://example.com/page.md): Optional one-line description
- [Another link](https://example.com/other.md): What this page covers

## Optional

- [Lower-priority resource](https://example.com/extra.md): Skippable secondary content
```

That's it. Conventions to know:

*   **Markdown links, not HTML.** The whole point is "easy for an LLM to parse."
*   **Link to `.md` versions of pages** when you can. Many doc systems will serve `page.md` alongside `page`; if yours doesn't, link to the HTML and accept the parse cost.
*   **Use `## Optional` for skippable content.** The spec gives this section special meaning — agents short on context can drop it.
*   **Be ruthless about curation.** The whole point is signal, not coverage. If you wouldn't want an LLM citing a page, don't list it.

## The full file family: llms.txt, llms-full.txt, llms-ctx.txt

The original proposal defined one file — `llms.txt`. Implementers have since added three companions. Knowing the difference matters because every "good" example you see in the wild uses two or more.

| File | What's in it | When to use |
| --- | --- | --- |
| `/llms.txt` | Curated index — H1, summary, link sections only | Always. The map. |
| `/llms-full.txt` | The full content of every linked page, concatenated as one Markdown blob | When you want a model to ingest your entire docs in one paste — sub-200K tokens preferably |
| `/llms-ctx.txt` | Pre-expanded context without URLs (cleaner for some models) | FastHTML-style implementations |
| `/llms-ctx-full.txt` | Pre-expanded context with URLs preserved | Same as above but URL-aware |

The most common pattern in 2026 is **llms.txt + llms-full.txt**: the index for orientation, the full-text dump for deep ingestion. Anthropic, Vercel, and LangGraph all do this.

## The state of adoption (May 2026)

This is the section most other guides skip. Here's the truth as of writing.

### Major LLM providers don't fetch it (much)

Server-log analysis from companies that have implemented `llms.txt` consistently shows the same pattern: GPTBot occasionally fetches, but rarely. ClaudeBot, Google-Extended, and PerplexityBot effectively don't. OpenAI's documented recommendation is to use `robots.txt` for crawler control, not `llms.txt`.

Google's John Mueller, asked about it on Reddit, compared `llms.txt` to the long-deprecated `keywords` meta tag: _"To me, it's comparable to the keywords meta tag — this is what a site-owner claims their site is about."_ The implication: a vendor-controlled metadata field that's vulnerable to spam and that the crawler can already get from the page itself.

### The 300,000-domain study

SERanking analyzed 300,000 domains in November 2025 to measure whether having an `llms.txt` file correlated with being cited by AI models. Findings:

*   About **10%** of sites had an `llms.txt`.
*   Adoption was nearly identical across low-, mid-, and high-traffic tiers (~9–10% each).
*   An XGBoost model trained on AI-citation data **improved** when the `llms.txt` variable was removed — meaning the file added noise rather than predictive signal.

The blunt summary: in May 2026, having an `llms.txt` file does not measurably improve your odds of being cited by ChatGPT, Claude, Gemini, or Perplexity in their search/answer surfaces.

### Where adoption _is_ happening

The story is different for IDE agents and developer tools:

*   **IDE agents** (Cursor, Continue, Cline, Aider) increasingly look for `llms.txt` when you point them at a documentation site.
*   **MCP servers** for documentation (e.g., Mintlify, GitBook MCP integrations) often consume `llms.txt` directly.
*   **Developer documentation platforms** (Mintlify, GitBook, Vercel Docs, Supabase Docs) auto-generate `llms.txt` for hosted projects.

So the realistic 2026 read is: **not (yet) an SEO play, but a developer-experience play**. If your site's important readers include developers using AI-assisted IDEs, an `llms.txt` measurably improves how those tools work.

## So why ship one anyway?

1.   **Cost is near-zero.** A serious `llms.txt` is a half-day's work; an automated one is a few hours of CI plumbing.
2.   **Optionality.** Major LLM crawlers may start respecting it. Being already-correct when that happens is cheap insurance.
3.   **The IDE-agent path is real.** If your audience includes developers using Cursor or Claude Code, `llms.txt` measurably improves how those agents reason about your docs.
4.   **The exercise itself is valuable.** Curating a one-paragraph summary and a 30-link index forces you to confront questions like "what would I _want_ a model to cite?" that most content teams haven't actually answered.
5.   **Bearish takes are bearish on outcomes, not effort.** No one is arguing that shipping `llms.txt` is harmful. The strongest skeptics (Ahrefs, SERanking, John Mueller) just point out the lack of measurable benefit.

## The three patterns (with real examples)

Mintlify's analysis of major adopters identifies three patterns that work. Pick the one that matches your site shape.

### 1. The Catalog (Stripe, Cloudflare)

For sites with many products. Group by major product area; under each, list quickstarts, concepts, API reference, tutorials. Each link gets descriptive text — not "API Reference" but "Payment Intents API: create, confirm, and capture payments."

Reference: [docs.stripe.com/llms.txt](https://docs.stripe.com/llms.txt?ref=codersera.com), [developers.cloudflare.com/llms.txt](https://developers.cloudflare.com/llms.txt?ref=codersera.com).

### 2. The Focused Workflow (Cursor, Mintlify)

For sites with a single product and concrete user workflows. Lead with what the agent capabilities are, not what the product is. Short — sometimes under 100 lines. Optimized for the model to find the four or five workflow pages a developer actually uses.

Reference: [docs.cursor.com/llms.txt](https://docs.cursor.com/llms.txt?ref=codersera.com) (when live), [mintlify.com/docs/llms.txt](https://mintlify.com/docs/llms.txt?ref=codersera.com).

### 3. Index + Export (Anthropic, Vercel, LangGraph)

The slim `llms.txt` indexes the docs; a sibling `llms-full.txt` dumps every linked page's content into one Markdown blob. Lets a model do orientation from `llms.txt` and deep ingestion from `llms-full.txt` in a single fetch.

Reference: [docs.claude.com/llms.txt](https://docs.claude.com/llms.txt?ref=codersera.com), [vercel.com/docs/llms-full.txt](https://vercel.com/docs/llms-full.txt?ref=codersera.com).

## Annotated real-world example

Here's the canonical shape of a good `llms.txt`, modeled on Stripe's catalog pattern:

```
# Acme Payments

> Acme Payments is a payments API for online businesses. Use these
> resources to integrate, accept payments, manage refunds, and
> understand fees.

## Getting started

- [Quickstart](https://docs.acme.com/quickstart.md): Five-minute integration with the JavaScript SDK
- [API authentication](https://docs.acme.com/auth.md): How to obtain and use API keys
- [Test mode](https://docs.acme.com/test-mode.md): Running the API in sandbox

## Core concepts

- [Payment intents](https://docs.acme.com/payments/intents.md): The recommended payment object lifecycle
- [Customers and payment methods](https://docs.acme.com/customers.md): Storing reusable payment methods
- [Webhooks](https://docs.acme.com/webhooks.md): Reliable event delivery and signature verification

## API reference

- [Payment intents API](https://docs.acme.com/api/payment-intents.md): Create, confirm, capture, cancel
- [Customers API](https://docs.acme.com/api/customers.md): CRUD plus payment-method attach/detach
- [Refunds API](https://docs.acme.com/api/refunds.md): Full and partial refunds
- [Disputes API](https://docs.acme.com/api/disputes.md): Evidence submission and lifecycle

## Errors and edge cases

- [Error codes](https://docs.acme.com/errors.md): Every documented error with cause and fix
- [Rate limits](https://docs.acme.com/rate-limits.md): Per-endpoint limits and backoff strategy
- [Idempotency](https://docs.acme.com/idempotency.md): Safe retries with idempotency keys

## Optional

- [Changelog](https://docs.acme.com/changelog.md): Release notes
- [Brand assets](https://acme.com/brand): Logo and colors
```

Things this gets right:

*   **One sentence per link.** The description tells the model _what the page answers_, not what it's titled.
*   **Links to `.md`.** Cleaner parse for the model.
*   **Sectioned in priority order.** Getting started → core → API → errors → optional. The model can stop reading at any heading and still have the right mental model.
*   **`## Optional` at the bottom** for things that aren't load-bearing.

### Manual

1.   List your site's most important 20–50 pages.
2.   Write a one-sentence description for each — what does this page _answer_?
3.   Group into 3–6 H2 sections.
4.   Move secondary content under `## Optional`.
5.   Write the H1 (your site name) and a 1–2 sentence summary blockquote.
6.   Save as plain text (UTF-8) to your site root: `public/llms.txt` in Next.js, `static/llms.txt` in Hugo, etc.
7.   Verify: `curl -s https://your-site.com/llms.txt | head -20`.

### Generators

If your docs site has a sitemap, several free tools will scrape and produce a starter file:

*   [Firecrawl's llms.txt generator](https://llmstxt.firecrawl.dev/?ref=codersera.com)
*   Mintlify's auto-generation (built into hosted Mintlify projects)
*   SiteSpeak AI, Writesonic, LiveChatAI — various free generators

Treat the generator output as a draft. Auto-generated `llms.txt` files are usually too long, miss the priority ordering, and skip the per-link descriptions. Edit by hand before shipping.

### In CI (the right answer for serious sites)

Generate `llms.txt` from your existing site structure in your build pipeline. The pattern:

*   Maintain a small YAML or JSON file describing what should be in your `llms.txt` (sections, key pages, descriptions).
*   A build script reads the YAML, optionally walks your sitemap for the optional/long-tail section, and emits `public/llms.txt`.
*   Run the script in CI on every commit.

For docs sites built on Mintlify, GitBook, Docusaurus, or VitePress, plugins exist that do this for you.

## A real example: codersera.com/llms.txt

Codersera ships its own `llms.txt` at [codersera.com/llms.txt](https://codersera.com/llms.txt?ref=codersera.com). The shape: catalog pattern, organized as About → Hire-by-stack → Tools → Pillar guides → Optional. Three things to call out:

*   **Top section is the value proposition.** An LLM that reads only the H1 and blockquote should already know what Codersera is and who we're for.
*   **Hire-by-stack pages each get a one-line gloss** ("Hire React developers: vetted React engineers with production experience in component architecture, hooks, and SSR") rather than just the page title.
*   **Pillar guides get descriptions naming the cluster.** If a model is asked about Claude Opus 4.7 or self-hosting LLMs, it should be able to find Codersera's deep dive without re-deriving "what's that page about" from the URL.

You can use it as a template — fork the structure, swap in your own pages.

## The actually-works alternative: robots.txt with AI-bot User-Agents

Today, the lever that actually controls how AI systems treat your site is `robots.txt`. Major AI crawlers respect User-Agent-specific rules, and most have published their official UA strings:

| Bot | User-Agent | Operator | Purpose |
| --- | --- | --- | --- |
| GPTBot | `GPTBot` | OpenAI | Training data for GPT |
| ChatGPT-User | `ChatGPT-User` | OpenAI | On-demand fetches when ChatGPT users browse |
| OAI-SearchBot | `OAI-SearchBot` | OpenAI | ChatGPT search index |
| ClaudeBot | `ClaudeBot` | Anthropic | Training data for Claude |
| Claude-User | `Claude-User` | Anthropic | On-demand fetches by Claude |
| Google-Extended | `Google-Extended` | Google | Gemini/Vertex training |
| PerplexityBot | `PerplexityBot` | Perplexity | Indexing for Perplexity answers |
| Perplexity-User | `Perplexity-User` | Perplexity | On-demand fetches |
| CCBot | `CCBot` | Common Crawl | Public web archive (used by many LLM trainers) |
| Meta-ExternalAgent | `Meta-ExternalAgent` | Meta | Llama training |
| Bytespider | `Bytespider` | ByteDance | Doubao, others |

To allow AI crawlers but disallow training data scraping while continuing to allow citation:

```
User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

# Still allow on-demand fetches for citation
User-agent: ChatGPT-User
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /
```

This is the lever that actually moves outcomes today. `llms.txt` complements it; it doesn't replace it.

## Copy-pasteable template

Strip out the placeholders, fill in your specifics, save to `public/llms.txt` (or your equivalent static directory):

```
# {Site Name}

> {One- or two-sentence description of the site, the audience, and what
> reading these resources will let an AI accomplish.}

## About

- [About](https://example.com/about): What we do and who we serve
- [Contact](https://example.com/contact): How to reach us

## Getting started

- [Quickstart](https://example.com/quickstart.md): Five-minute setup
- [Authentication](https://example.com/auth.md): Get an API key

## Core concepts

- [Concept A](https://example.com/concepts/a.md): The thing you'll reach for first
- [Concept B](https://example.com/concepts/b.md): The thing you'll reach for second

## API reference

- [Resource X](https://example.com/api/x.md): X endpoints
- [Resource Y](https://example.com/api/y.md): Y endpoints

## Optional

- [Changelog](https://example.com/changelog): Release notes
- [Blog](https://example.com/blog): Long-form articles
```

## FAQ

### Where do I put llms.txt?

At the root of your domain — `https://yoursite.com/llms.txt`. In Next.js, that's `public/llms.txt`. In Hugo, `static/llms.txt`. In a static-host setup, the same directory as `robots.txt` and `sitemap.xml`.

### Does Google use llms.txt?

Not as a ranking or AI-citation signal. John Mueller compared it to the deprecated `keywords` meta tag. Google included `llms.txt` in the Agent2Agent (A2A) protocol spec but hasn't committed Gemini or its search systems to fetching it.

### Does Anthropic / Claude use llms.txt?

Claude itself doesn't crawl `llms.txt` as part of training or search. Anthropic ships an `llms.txt` for its own docs, primarily for IDE agent and MCP integration use.

### Does OpenAI / ChatGPT use llms.txt?

GPTBot occasionally fetches it but rarely. OpenAI's documented recommendation for crawler control is `robots.txt`.

### Will it improve my AI citations?

Not measurably as of May 2026, per a 300,000-domain study by SERanking. The exception: developer-tool sites where IDE agents are part of the audience.

### Should I use llms.txt or robots.txt?

Both. `robots.txt` with explicit User-Agent rules for GPTBot, ClaudeBot, Google-Extended, etc. is the lever that controls outcomes today. `llms.txt` is a cheap-to-ship complement that may matter more in the future.

### What's the difference between llms.txt and llms-full.txt?

`llms.txt` is a curated index of links. `llms-full.txt` is the full Markdown content of every page in the index, concatenated into one file — useful when you want a model to ingest your entire docs in a single fetch.

### Can llms.txt block crawlers?

No. It's an inclusion file, not a restriction file. To block crawlers, use `robots.txt`.

### Is there a generator I can use?

Yes. [Firecrawl's generator](https://llmstxt.firecrawl.dev/?ref=codersera.com) is the most popular. Mintlify auto-generates one for hosted Mintlify projects. Treat the output as a draft and edit before shipping — auto-generated files tend to be too long and skip the per-link descriptions that make the file useful.

### What size should llms-full.txt be?

Aim for under 200K tokens (roughly 150K words / ~700KB) so a model can ingest it in one shot at typical context windows. If your docs exceed that, split into language- or product-segmented exports the way Supabase does.

### Do I need to update llms.txt every time I publish a new page?

For a curated catalog, yes — but only if the new page belongs in the curated set (not every blog post belongs in your `llms.txt`). For sites that auto-generate the file from a sitemap in CI, this happens for free.

## The bottom line

llms.txt in May 2026 is a low-cost, low-yield bet with clear optionality. Major LLM crawlers don't fetch it yet. SEO-citation studies show no measurable improvement. Google calls it the next keywords meta tag. And yet — every serious developer-tool site is shipping one anyway, because the cost is a half-day, the IDE-agent ecosystem already uses it, and the day a major LLM provider decides to respect it, you'll be glad you were already correct.

Ship it. Keep `robots.txt` updated with the AI-bot User-Agents. Don't expect AI traffic to spike. And stay honest with yourself about which of the two is doing the real work.

* * *

## Hire engineers who understand the AI-discoverability stack

Knowing where llms.txt fits — and where it doesn't — is exactly the kind of small architectural detail that separates engineers who ship working systems from engineers who chase trends. [Codersera](https://codersera.com/hire-developer?ref=codersera.com) matches you with vetted remote engineers who think clearly about web standards, SEO, and the parts of "AI optimization" that actually move metrics. Each developer is technically interviewed, reference-checked, and ready to extend your engineering team — with a risk-free trial period.
