---
title: "Introduction - Firecrawl Docs"
description: "Firecrawl API Reference (v2)"
url: "https://docs.firecrawl.dev/api-reference/v2-introduction"
publishedTime: "Mon, 18 May 2026 18:14:45 GMT"
---

[Skip to main content](https://docs.firecrawl.dev/api-reference/v2-introduction#content-area)

[Firecrawl Docs home page![Image 1: light logo](https://mintcdn.com/firecrawl/iilnMwCX-8eR1yOO/logo/logo.png?fit=max&auto=format&n=iilnMwCX-8eR1yOO&q=85&s=c45b3c967c19a39190e76fe8e9c2ed5a)![Image 2: dark logo](https://mintcdn.com/firecrawl/iilnMwCX-8eR1yOO/logo/logo-dark.png?fit=max&auto=format&n=iilnMwCX-8eR1yOO&q=85&s=3fee4abe033bd3c26e8ad92043a91c17)](https://firecrawl.dev/)

v2 English

Search...

Ctrl K

*   [Status](https://firecrawl.betteruptime.com/)
*   [Support](mailto:help@firecrawl.com)
*   [Sign Up](https://www.firecrawl.dev/signin?utm_source=firecrawl_docs&utm_medium=nav_bar&utm_content=sign_up)
*   [firecrawl/firecrawl 121,722](https://github.com/firecrawl/firecrawl "firecrawl/firecrawl")
*   [firecrawl/firecrawl 121,722](https://github.com/firecrawl/firecrawl "firecrawl/firecrawl")

Search...

Navigation

Using the API

Introduction

[Documentation](https://docs.firecrawl.dev/introduction)[SDKs](https://docs.firecrawl.dev/sdks/overview)[Integrations](https://www.firecrawl.dev/app)[API Reference](https://docs.firecrawl.dev/api-reference/v2-introduction)[Build with AI](https://docs.firecrawl.dev/ai-onboarding)

*   [Playground](https://firecrawl.dev/playground)
*   [Blog](https://firecrawl.dev/blog)
*   [Community](https://discord.gg/firecrawl)
*   [Changelog](https://firecrawl.dev/changelog)

##### Using the API

*   [Introduction](https://docs.firecrawl.dev/api-reference/v2-introduction)
*   [Errors](https://docs.firecrawl.dev/api-reference/errors)

##### Search Endpoints

*   [POST Search](https://docs.firecrawl.dev/api-reference/endpoint/search)

##### Scrape Endpoints

*   [POST Scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape)
*   [POST Batch Scrape](https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape)
*   [GET Get Batch Scrape Status](https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-get)
*   [DEL Cancel Batch Scrape](https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-delete)
*   [GET Get Batch Scrape Errors](https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-get-errors)

##### Interact Endpoints

*   [POST Interact with the page](https://docs.firecrawl.dev/api-reference/endpoint/scrape-execute)
*   [DEL Stop Interacting](https://docs.firecrawl.dev/api-reference/endpoint/scrape-browser-delete)
*   [GET List Browser Sessions](https://docs.firecrawl.dev/api-reference/endpoint/browser-list)

##### Map Endpoints

*   [POST Map](https://docs.firecrawl.dev/api-reference/endpoint/map)

##### Parse Endpoints

*   [POST Parse](https://docs.firecrawl.dev/api-reference/endpoint/parse)

##### Crawl Endpoints

*   [POST Crawl](https://docs.firecrawl.dev/api-reference/endpoint/crawl-post)
*   [GET Get Crawl Status](https://docs.firecrawl.dev/api-reference/endpoint/crawl-get)
*   [POST Crawl Params Preview](https://docs.firecrawl.dev/api-reference/endpoint/crawl-params-preview)
*   [DEL Cancel Crawl](https://docs.firecrawl.dev/api-reference/endpoint/crawl-delete)
*   [GET Get Crawl Errors](https://docs.firecrawl.dev/api-reference/endpoint/crawl-get-errors)
*   [GET Get Active Crawls](https://docs.firecrawl.dev/api-reference/endpoint/crawl-active)

##### Agentic Debugging Endpoints

*   [POST Ask](https://docs.firecrawl.dev/api-reference/endpoint/ask)
*   [POST Docs Search](https://docs.firecrawl.dev/api-reference/endpoint/docs-search)

##### Account Endpoints

*   [GET Activity](https://docs.firecrawl.dev/api-reference/endpoint/activity)
*   [GET Credit Usage](https://docs.firecrawl.dev/api-reference/endpoint/credit-usage)
*   [GET Historical Credit Usage](https://docs.firecrawl.dev/api-reference/endpoint/credit-usage-historical)
*   [GET Token Usage](https://docs.firecrawl.dev/api-reference/endpoint/token-usage)
*   [GET Historical Token Usage](https://docs.firecrawl.dev/api-reference/endpoint/token-usage-historical)
*   [GET Queue Status](https://docs.firecrawl.dev/api-reference/endpoint/queue-status)

##### Webhook Payloads

*   Crawl  
*   Batch Scrape  

##### Partner Integration

*   [Partner Integration API](https://docs.firecrawl.dev/partner-integration)

On this page

*   [Features](https://docs.firecrawl.dev/api-reference/v2-introduction#features)
*   [Agentic Features](https://docs.firecrawl.dev/api-reference/v2-introduction#agentic-features)
*   [Base URL](https://docs.firecrawl.dev/api-reference/v2-introduction#base-url)
*   [Authentication](https://docs.firecrawl.dev/api-reference/v2-introduction#authentication)
*   [Response codes](https://docs.firecrawl.dev/api-reference/v2-introduction#response-codes)
*   [429 responses](https://docs.firecrawl.dev/api-reference/v2-introduction#429-responses)

![Image 3: Firecrawl](https://docs.firecrawl.dev/logo/light.svg)![Image 4: Firecrawl](https://docs.firecrawl.dev/logo/dark.svg)
### Ready to build?

Start getting web data for free and scale seamlessly as your project expands. **No credit card needed.**

[Start for free](https://www.firecrawl.dev/signin?utm_source=firecrawl_docs&utm_medium=docs_card&utm_content=start_for_free)[See our plans](https://www.firecrawl.dev/pricing?utm_source=firecrawl_docs&utm_medium=docs_card&utm_content=see_our_plans)

Using the API

# Introduction

Copy page

Firecrawl API Reference (v2)

Copy page

> ## Documentation Index
> 
> 
> Fetch the complete documentation index at: [https://docs.firecrawl.dev/llms.txt](https://docs.firecrawl.dev/llms.txt)
> 
> 
> Use this file to discover all available pages before exploring further.

**For AI agents:** Use [llms.txt](https://docs.firecrawl.dev/llms.txt) for a full index of all documentation.

The Firecrawl API gives you programmatic access to web data. All endpoints share a common base URL, authentication scheme, and response format described on this page.
## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#features)

Features

## [Scrape Extract content from any webpage in markdown or json format.](https://docs.firecrawl.dev/api-reference/endpoint/scrape)

## [Parse Upload files and parse them into markdown or other formats.](https://docs.firecrawl.dev/api-reference/endpoint/parse)

## [Crawl Crawl entire websites and get content from all pages.](https://docs.firecrawl.dev/api-reference/endpoint/crawl-post)

## [Map Get a complete list of URLs from any website quickly and reliably.](https://docs.firecrawl.dev/api-reference/endpoint/map)

## [Search Search the web and get full page content in any format.](https://docs.firecrawl.dev/api-reference/endpoint/search)

## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#agentic-features)

Agentic Features

## [Agent Autonomous web data gathering powered by AI.](https://docs.firecrawl.dev/api-reference/endpoint/agent)

## [Browser Create and control browser sessions for interactive web tasks.](https://docs.firecrawl.dev/api-reference/endpoint/browser-create)

## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#base-url)

Base URL

All requests use the following base URL:

```
https://api.firecrawl.dev
```

## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#authentication)

Authentication

Every request requires an `Authorization` header with your API key:

```
Authorization: Bearer fc-YOUR-API-KEY
```

Include this header in all API calls. You can find your API key in the [Firecrawl dashboard](https://www.firecrawl.dev/app/api-keys).

cURL

Python

Node

```
curl -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Authorization: Bearer fc-YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#response-codes)

Response codes

Firecrawl uses conventional HTTP status codes to indicate the outcome of your requests. Codes in the `2xx` range indicate success, `4xx` codes indicate client errors, and `5xx` codes indicate server errors.See [Errors](https://docs.firecrawl.dev/api-reference/errors) for the full reference, including the `error` string returned for each failure mode, retry guidance, and a copy-pasteable backoff snippet.
## [​](https://docs.firecrawl.dev/api-reference/v2-introduction#429-responses)

429 responses

When you exceed your plan’s rate or concurrency limits, the API returns a `429` status code. See [Rate Limits](https://docs.firecrawl.dev/rate-limits) for per-plan limits and [Errors](https://docs.firecrawl.dev/api-reference/errors) for retry guidance.

[Suggest edits](https://github.com/firecrawl/firecrawl-docs/edit/main/api-reference/v2-introduction.mdx)[Raise issue](https://github.com/firecrawl/firecrawl-docs/issues/new?title=Issue%20on%20docs&body=Path:%20/api-reference/v2-introduction)

[Errors Next](https://docs.firecrawl.dev/api-reference/errors)

Ctrl+I

[Firecrawl Docs home page![Image 5: light logo](https://mintcdn.com/firecrawl/iilnMwCX-8eR1yOO/logo/logo.png?fit=max&auto=format&n=iilnMwCX-8eR1yOO&q=85&s=c45b3c967c19a39190e76fe8e9c2ed5a)![Image 6: dark logo](https://mintcdn.com/firecrawl/iilnMwCX-8eR1yOO/logo/logo-dark.png?fit=max&auto=format&n=iilnMwCX-8eR1yOO&q=85&s=3fee4abe033bd3c26e8ad92043a91c17)](https://firecrawl.dev/)

[x](https://x.com/firecrawl)[github](https://github.com/firecrawl/firecrawl)[linkedin](https://www.linkedin.com/company/firecrawl)[discord](https://discord.gg/firecrawl)

[Agent docs (llms.txt)](https://docs.firecrawl.dev/llms.txt)[Full docs (llms-full.txt)](https://docs.firecrawl.dev/llms-full.txt)[Agent skill](https://docs.firecrawl.dev/sdks/cli)[MCP server](https://docs.firecrawl.dev/mcp-server)

[x](https://x.com/firecrawl)[github](https://github.com/firecrawl/firecrawl)[linkedin](https://www.linkedin.com/company/firecrawl)[discord](https://discord.gg/firecrawl)

[Powered by This documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=firecrawl)
