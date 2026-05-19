---
title: "Guide to AI User Agents"
description: "When users ask questions in AI platforms like ChatGPT, AI retrieves content from your site in real-time. This guide explains how you can ensure your site is optimized to be returned and cited in AI search results, even if you don't want them to train AI on your content."
url: "https://scrunch.com/resources/guides/guide-to-ai-user-agents/"
---

When users ask questions in ChatGPT, ChatGPT’s `ChatGPT-User` bot actually runs web searches and downloads search result pages in real time to source up-to-date information for the user. Perplexity and Meta’s AI search features have the same behavior.

This is a separate process from search indexing (the traditional way `Googlebot` or `Bingbot` crawl websites on an ongoing basis) or the periodic collection of training data that AI companies use to build models. (For most AI search platforms you can opt-out of having the AI train on your content while still being surfaced in search results.)

As a website operator, just like you want to be findable in Google, you want to be citable by AI assistants — AI search is one of the fastest growing consumer apps of all time, and users who eventually click through to your site from AI answers are better qualified and more likely to convert. And unlike traditional web search, when you update a page that is getting retrieved and cited by ChatGPT or Perplexity, the updated content is reflected in the AI’s answers in real time.

## tl;dr – What user agents should I allowlist to be cited and get traffic from AI platforms?

| Platform | Robots.txt Identifier | User-Agent header value |
| --- | --- | --- |
| ChatGPT | `ChatGPT-User` | `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot` |
| Meta AI | `meta-externalagent` `meta-externalfetcher` `facebookexternalhit` | `facebookexternalhit/1.1` `meta-externalagent/1.1` `meta-externalfetcher/1.1` |
| Perplexity | `PerplexityBot` | `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)` |
| Google AI Overviews | `Googlebot` | `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36` |
| Google Gemini | `Googlebot-extended` | N/A (Uses `Googlebot` user agent. `robots.txt` controls how Google uses the data.) |

Your site must also be indexed by normal web search engines, so allow `Googlebot` and `Bingbot` if you have not already done so.

## What user agents is it safe to block? How can I stop AI models from being trained on my data?

In general, we recommend organizations for whom monetizing content is not a primary revenue stream consider allowing at least _some_ training data collection from your web properties. The more models are trained on general information about your brand, products, and services, the more likely you are to be correctly represented by model answers across the widest range of inquiries.

That being said, OpenAI’s training data crawler can be blocked without affecting your ability to receive citations in ChatGPT. You can also safely block training data collection from Anthropic (Claude) and Common Crawl without affecting your ability to be cited by chatbots. So you can block:

*   `GPTBot`
*   `ClaudeBot`
*   `CCBot`

without any immediately negative effects.

Unfortunately, it’s unclear if it’s possible to disable training data collection from Meta or Google without affecting your presence and ability to be cited in Gemini and Meta AI. We’ll update as we gain more clarity into their user agent / bot policies.

## How to allow or block AI user agents

There are two mechanisms for bot control that websites commonly deploy:

### robots.txt

These are rules published on a per-domain basis that reputable bot operators (including OpenAI / ChatGPT) follow when deciding whether to access content. You can block user agents entirely or restrict them to specific content.

However, `robots.txt` is an opt-in mechanism that web crawlers and other agents that are retrieving your content must specifically decide to obey. (It _is_ considered a major breach of internet etiquette to ignore `robots.txt`.)

You should also be aware that there are some cases where `robots.txt` rules may be considered not to apply. For example, it’s common for internet platforms to retrieve URLs that users submit to generate content previews or check for malicious pages. These aren’t typically considered to be violations of `robots.txt` rules because they are the direct result of a user action — not an automated crawler.

### Anti-bot middleware, web application firewalls, etc.

Some website providers employ more stringent network-level anti-bot protections. If you run your website in-house, they’re also often deployed by in-house IT teams. Examples of these products include Cloudflare Bot Management, Imperva, Akamai Bot Manager, and the Bot Control feature of AWS Web Application Firewall.

These are a technical enforcement mechanism that either completely block suspected bot traffic (based on their user agent, but also signals like source IP address and browsing behavior) or require the completion of a captcha or other anti-bot challenge before allowing visitors to access the actual page content.

### Recommendations

We’ve seen that many websites across the internet have turned on anti-bot protections from vendors like Cloudflare. In particular, many media properties do not want their content to be used to train LLMs that may compete with them in the future.

However, this anti-bot blocking is also preventing ChatGPT’s “real time retrieval” feature from operating. This means that ChatGPT will not be able to access the page content, even when a user is specifically asking about your brand / page, and will typically not cite your pages in ChatGPT responses.

We recommend allowlisting _at least_ OpenAI’s real time retrieval user agent and OpenAI’s search crawler to access your content by setting up your `robots.txt` to allow them to access content similarly to Googlebot and Bingbot, and also configuring any anti-bot protection to allow them through.

## User Agents and JavaScript or Dynamic Content

Unlike `Googlebot`, most AI bots are not currently able to execute JavaScript and load dynamic content on web pages. Pages where there is also no meaningful content available without JavaScript are also very unlikely to be cited.

## User Agent Reference

### OpenAI (ChatGPT)

Highest priority – ChatGPT is the largest intentional destination for AI assistant users and is aggressively pursuing search market share.

OpenAI documents their bot user agents here: [https://platform.openai.com/docs/bots](https://platform.openai.com/docs/bots)

If you are concerned about “impersonator bots”, OpenAI also publishes IP ranges their bots operate from for verification that a particular bot interaction is really from them (similar to Google.)

*   `ChatGPT-User` – Used for real time retrieval of page content. Most critical. Full user agent string `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot`
*   `OAI-SearchBot` – Used for search indexing on ChatGPT specifically. Note: ChatGPT relies on Bing for almost all search results currently, so this is not absolutely critical yet. However, we recommend allowlisting it to future-proof your availability in ChatGPT Search. Full user agent string `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot`
*   `GPTBot` – Used for training data collection. You can block GPTBot if you do not want content from your website to be trained into OpenAI’s models in the future. We recommend allowing GPTBot to access at least core, evergreen information about your brand, products and services to maximize your presence and performance in ChatGPT answers. You may want to take a more granular approach to allowing or prohibiting training data collection of more rapidly changing content. Note that there is a 6-12 month delay before collected training data is reflected in model answers and it is not guaranteed that any particular fact will “be remembered” by the model.

OpenAI has publicly stated that they do not train on data collected via ChatGPT-User or OAI-Searchbot.

### Meta AI

Meta documents their bot user agents here: [https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/#identify-2](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/#identify-2)

Meta documents IP ranges their bots operate from for additional certainty: [https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/#identify-5](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/#identify-5)

Meta is rapidly evolving their AI assistant products, which are most frequently used inside Instagram, Whatsapp and the Facebook app – the search functionality in all products now initiates a chatbot search / conversation in geos where Meta AI is supported. Mark Zuckerberg has publicly stated Meta AI has >500M MAUs.

Meta user agents are in flux. We recommend allowlisting the following:

*   `facebookexternalhit/1.1` – Facebook uses this user agent for generating social media previews, but in early iterations of Meta AI search it was also used to retrieve page content in real time, similar to ChatGPT-User. This function now seems to be migrating to `meta-externalagent`
*   `meta-externalagent/1.1` – Facebook documents that this user agent is used for search crawling and training data collection, but in our testing, it is also used for real time retrieval.
*   `meta-externalfetcher/1.1` – Facebook documents that this user agent is used to retrieve specific URLs provided by the user, i.e. not URLs found via search results. This could be used for instance when a user wants to summarize a web page in AI chat.

Note: in some cases `facebookexternalhit` and `meta-externalfetcher` may bypass `robots.txt` rules in some scenarios (when a user provides a specific URL as context) – their rationale for this is because they are “passing through” a user-initiated action rather than initiating a request automatically.

Unfortunately, there is currently not a clear distinction between Meta bots that collect training data and bots that service real-time user activity.

### Perplexity

Perplexity documents their bot user agents here: [https://docs.perplexity.ai/guides/bots](https://docs.perplexity.ai/guides/bots)

The primary user agent we’ve observed Perplexity use is `PerplexityBot`, which we’ve seen used for both periodic search indexing (non-user initiated) and for real time content retrieval. They have also now published IP ranges they operate from. Perplexity documents that `PerplexityBot` will obey `robots.txt` directives. Perplexity recently rolled out a second bot user agent, `Perplexity-User`.

Perplexity uses foundation models from other providers like OpenAI and Meta (Llama) and doesn’t train their own models at any scale and therefore [state that they don’t use any bot-collected data for training](https://www.perplexity.ai/help-center/en/articles/10354969-how-does-perplexity-follow-robots-txt#h_83a0c31385).

User agents:

*   `PerplexityBot` – Full user agent string is `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)`
*   `Perplexity-User` – Full user agent string is `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)`

Perplexity has been the subject of a lot of controversy related to scraping / rehosting media content and allegedly not obeying `robots.txt` directives. [Perplexity’s Help Center states](https://www.perplexity.ai/help-center/en/articles/10354969-how-does-perplexity-follow-robots-txt#h_77240f4372) that the reason for this behavior was a feature that allowed users to ask questions of specific URLs, rather than automated scraping, and that this feature has now been removed.

However, the most recent updates to Perplexity’s bot documentation state that `Perplexity-User` can ignore `robots.txt` directives when a user provides a specific URL as context. It’s worth noting that Meta documents a similar behavior (see above) with a similar rationale.

### Google: Gemini and Google AI Overviews

Google’s AI platforms operate differently than others by virtue of their access to Google’s raw search index.

Google documents all their bots here: [https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)

From the perspective of Gemini, the important user agent is `googlebot-extended`: [https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended)

*   `Googlebot-extended` – Used to crawl training data for Google’s Gemini models, but blocking `googlebot-extended` in `robots.txt` may also prevent Gemini from using pages for Gemini’s “Grounding with Google Search” feature, which could prevent citations to your pages. Note that the actual user agent `Googlebot-extended` shows up as in your logs when retrieving content may differ.

Outside of Gemini, Google AI Overviews (previously “Search Generative Experience”) use a different mechanism and obey the same rules as regular `Googlebot` – so if your content is technically accessible to Google search, it is currently also accessible to AI Overviews.

### Anthropic (Claude)

Anthropic’s Claude is widely used in certain verticals, particularly for software engineering. However, unlike other LLM platforms, Claude currently does not have the ability to search the web or dynamically access web content.

Anthropic documents the user agent their training data collector operates under here: [https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

In short, you can disallow Anthropic training data collection by dis-allowing `ClaudeBot` in `robots.txt`. Anthropic also obeys `robots.txt` directives for Common Crawl’s `CCBot`.

### Common Crawl

Common Crawl is a noncommercial organization that crawls the web to create a massive open source archive of web content. Common Crawl itself does not train AI models. However, the Common Crawl dataset is a common input used to train large language models across multiple providers, including earlier versions of OpenAI’s models. Many smaller AI labs still do not operate their own web crawlers and instead use the Common Crawl dataset (or [refinements of it](https://huggingface.co/datasets/HuggingFaceFW/fineweb)) to train models.

Common Crawl documents their web crawler here: [https://commoncrawl.org/ccbot](https://commoncrawl.org/ccbot) and obeys `robots.txt` directives for `CCBot`.
