---
title: "What is PerplexityBot?"
description: "PerplexityBot is a web crawler that indexes content for Perplexity's AI-powered search service, providing referenced sources while explicitly not collecting data for AI model training."
url: "https://usehall.com/agents/perplexitybot"
publishedTime: "2025-09-17T04:54:12.057Z"
---

## What is PerplexityBot?

PerplexityBot is a web crawler operated by [Perplexity](https://perplexity.ai/), a company that provides an AI-powered search and answering service. It functions as an AI search crawler that indexes web content to power Perplexity’s search results. The bot is designed specifically to surface and link websites in search results on Perplexity’s platform.

When PerplexityBot visits your site, it identifies itself with the user-agent string: `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)`. This allows website administrators to identify its activity in their server logs.

Unlike some other AI crawlers, Perplexity explicitly states that PerplexityBot is not used to crawl content for training AI foundation models. Instead, it focuses on indexing content that will be referenced and linked in Perplexity’s search results.

## Why is PerplexityBot crawling my site?

PerplexityBot crawls websites to gather and index information that helps Perplexity deliver relevant search results to its users. It’s looking for content that can be referenced when users ask questions through Perplexity’s interface.

The frequency of PerplexityBot visits doesn’t follow a fixed schedule. Like other AI search crawlers, its visitation patterns vary widely based on numerous factors, including your site’s popularity, content freshness, and relevance to common queries. Crawling can even happen on-demand in response to specific user queries.

This crawling is a standard practice for search engines and is generally considered authorized as long as the bot respects your robots.txt directives. The goal is to make your content discoverable through Perplexity’s platform.

## What is the purpose of PerplexityBot?

PerplexityBot supports Perplexity’s AI-powered search service by building an index of web content that can be referenced when answering user questions. When users ask Perplexity a question, the system can draw on this indexed content to provide accurate answers.

A key characteristic of Perplexity’s service is that it typically includes references to websites as inline sources in its answers. This attribution can drive traffic to your site when users click through to access the original content.

For website owners, being included in Perplexity’s index can provide value by creating another discovery channel for your content. As AI search becomes more prevalent, having your content properly indexed by services like Perplexity may become increasingly important for visibility.

## How do I block PerplexityBot?

PerplexityBot respects standard robots.txt directives. If you wish to block it from crawling your site, you can add the following to your robots.txt file:

```
User-agent: PerplexityBot
Disallow: /
```

This will instruct PerplexityBot not to crawl any part of your site. If you want to block it from specific sections only, you can modify the Disallow line accordingly:

```
User-agent: PerplexityBot
Disallow: /private-section/
```

Perplexity publishes its crawler IP addresses at [https://www.perplexity.com/perplexitybot.json](https://www.perplexity.com/perplexitybot.json), which can be useful for verification or additional access control if needed.

Before blocking PerplexityBot, consider that doing so may reduce your content’s visibility in Perplexity’s search results. Since Perplexity typically provides attribution and links to source websites, allowing the bot can potentially drive traffic to your site. Additionally, unlike some AI crawlers, Perplexity explicitly states that PerplexityBot is not used for training AI foundation models, which may address a common concern about AI crawlers.

Changes to your robots.txt file may take up to 24 hours to be recognized by Perplexity’s systems.
