---
title: "Reader API"
description: "Convert any URL to Markdown for better grounding LLMs."
url: "https://jina.ai/reader/"
publishedTime: "Wed, 13 May 2026 06:16:28 GMT"
---

Welcome home!

[![Image 1](https://jina.ai/Jina%20-%20Light.svg) * * * ![Image 2](https://jina.ai/Elastic%20-%20Light.svg)](https://jina.ai/)

_search_[News](https://jina.ai/news)[Models](https://jina.ai/models)API _arrow\_drop\_down_ _settings_[_login_](https://jina.ai/api-dashboard?login=true)

# Reader

Convert a URL to LLM-friendly input, by simply adding `r.jina.ai` in front.

_code_ API

* * *

_play\_arrow_ Demo _arrow\_drop\_down_

* * *

_attach\_money_ Pricing

## [Reader API](https://jina.ai/reader/#apiform)

Convert a URL to LLM-friendly input, by simply adding `r.jina.ai` in front.

_login_

_key_ API Key & Billing

_code_ Usage

_more\_horiz_ More

_chevron\_left_ _chevron\_right_

* * *

[_home_](https://jina.ai/reader)

[_speed_ Rate Limit](https://jina.ai/api-dashboard/rate-limit)

[_bug\_report_ Raise issue](https://github.com/jina-ai/reader/issues)

[_help\_outline_ FAQ](https://jina.ai/reader#faq)

_menu\_book_ Docs _arrow\_drop\_down_

[Status](https://status.jina.ai/)

_chevron\_left_ _chevron\_right_

* * *

_globe\_book_

Use `r.jina.ai` to read a URL and fetch its content

_travel\_explore_

Use `s.jina.ai` to search the web and get SERP

_![Image 3](blob:http://localhost/b78a1f382d77c37ecc505845c9fc4dcf)_

Add `mcp.jina.ai` as your MCP server to access our API in LLMs

* * *

Parameters

_arrow\_drop\_down_

 

The target URL to fetch content from

 

Add API Key for Higher Rate Limit 

Enter your Jina API key to access a higher rate limit. For latest rate limit information, please refer to the table below.[_open\_in\_new_ Learn more](https://jina.ai/reader#rate-limit)

 

Browser Engine (Quality/Speed) 

Choose the browser engine for fetching the webpage content. This affects the quality, speed, completeness, accessibility of the content.[_open\_in\_new_ Learn more](https://jina.ai/api-dashboard/reader-speed-test)

Default

_arrow\_drop\_down_

 

 

Content Format 

You can control the level of detail in the response to prevent over-filtering. The default pipeline is optimized for most websites and LLM input.

Default

_arrow\_drop\_down_

 

 

JSON Response 

The response will be in JSON format, containing the URL, title, content, and timestamp (if available). In Search mode, it returns a list of five entries, each following the described JSON structure.

- [x] 

 

Timeout (seconds) 

Maximum time to wait for page load. Increase for slow pages, decrease for simple static pages.

- [x] 

 

Token Budget 

Limits the maximum number of tokens used for this request. Exceeding this limit will cause the request to fail.

- [x] 

 

Use ReaderLM-v2 

Experimental

Uses ReaderLM-v2 for HTML to Markdown conversion, to deliver high-quality results for websites with complex structures and contents. Costs 3x tokens![_open\_in\_new_ Learn more](https://jina.ai/news/readerlm-v2-frontier-small-language-model-for-html-to-markdown-and-json)

- [x] 

 

Extract Only (CSS Selector) 

Only extract content matching these CSS selectors. Example: article, .main-content, #post-body

- [x] 

 

body 

.class 

#id 

 

Wait For (CSS Selector) 

Wait until these elements appear before extracting content. Useful for dynamically loaded content.

- [x] 

 

body 

.class 

#id 

 

Exclude (CSS Selector) 

Remove these elements before extraction. Example: nav, footer, .sidebar, #ads

- [x] 

 

header 

.class 

#id 

 

Remove All Images 

Strip all images from the output. Reduces token usage when images are not needed.

- [x] 

 

OpenAI Citation Format 

Format links for OpenAI's web browsing tool. Uses special citation markers compatible with GPT models.[_open\_in\_new_ Learn more](https://cookbook.openai.com/articles/openai-harmony#browser-tool)

- [x] 

 

Links Summary Section 

A "Buttons & Links" section will be created at the end. This helps the downstream LLMs or web agents navigating the page or take further actions.

None

_arrow\_drop\_down_

 

 

Images Summary Section 

An "Images" section will be created at the end. This gives the downstream LLMs an overview of all visuals on the page, which may improve reasoning.

None

_arrow\_drop\_down_

 

 

Browser Viewport Size 

POST

Set browser window dimensions. Affects responsive layouts and content visibility.[_open\_in\_new_ Learn more](https://pptr.dev/api/puppeteer.viewport)

- [x] 

 

Forward Cookie 

Our API server can forward your custom cookie settings when accessing the URL, which is useful for pages requiring extra authentication. Note that requests with cookies will not be cached.[_open\_in\_new_ Learn more](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)

- [x] 

 

<cookie-name>=<cookie-value>

<cookie-name-1>=<cookie-value>; domain=<cookie-1-domain>

 

Image Caption 

Captions all images at the specified URL, adding 'Image [idx]: [caption]' as an alt tag for those without one. This allows downstream LLMs to interact with the images in activities such as reasoning and summarizing.

- [x] 

 

Use a Proxy Server 

Our API server can utilize your proxy to access URLs, which is helpful for pages accessible only through specific proxies.[_open\_in\_new_ Learn more](https://en.wikipedia.org/wiki/Proxy_server)

- [x] 

 

Use a Country-Specific Proxy Server 

Set country code for location-based proxy server. Use 'auto' for optimal selection or 'none' to disable.

- [x] 

 

Bypass Cached Content 

Our API caches URL contents for a certain amount of time. Set it to true to ignore the cached result and fetch the content from the URL directly.

- [x] 

 

Cache Tolerance (seconds) 

Accept cached content if younger than N seconds. Set to 0 for fresh content (same as Bypass Cache), or higher values to allow faster responses from cache.

- [x] 

 

Page Ready Timing 

When to consider a page fully loaded. Later timings wait longer but capture more dynamic content.

Default

_arrow\_drop\_down_

 

 

Custom User-Agent 

Override the browser User-Agent string. Useful for accessing sites that require specific browsers or block crawlers.

- [x] 

 

Custom Referer 

Set the HTTP Referer header. Some sites check this to verify traffic comes from expected sources.

- [x] 

 

Preserve Base64 Images 

Keep inline base64-encoded images in markdown output instead of converting them to external URLs.

- [x] 

 

Do Not Cache or Track 

Prevent this request from being cached or logged on our servers. Use for sensitive URLs.

- [x] 

 

Github Flavored Markdown 

Opt in/out features from GFM (Github Flavored Markdown).

Enabled

_arrow\_drop\_down_

 

 

Stream Mode 

Stream mode is beneficial for large target pages, allowing more time for the page to fully render. If standard mode results in incomplete content, consider using Stream mode.[_open\_in\_new_ Learn more](https://github.com/jina-ai/reader?tab=readme-ov-file#streaming-mode)

- [x] 

 

Customize Browser Locale 

Control the browser locale to render the page. Lots of websites serve different content based on the locale.[_open\_in\_new_ Learn more](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language)

- [x] 

 

Respect robots.txt 

Check robots.txt rules before fetching. Specify which bot name to use for the check.

- [x] 

 

Include iframe Content 

Extract content from embedded iframes. Enable for pages with content loaded in iframes.

- [x] 

 

Include Shadow DOM 

Extract content from Shadow DOM components. Enable for pages using web components.

- [x] 

 

Use Final URL as Base 

Resolve relative URLs using the final destination URL after redirects, instead of the original URL.

- [x] 

 

Local PDF/HTML file 

POST

Use Reader on your local PDF and HTML file by uploading them. Only support pdf and html files. For HTML, please also specify a reference URL for better parsing related CSS/JS scripts.

_upload_

 

 

Run JavaScript Before Extraction 

POST

Execute custom JS to modify the page before content extraction. Can be inline code or a URL to a script file.[_open\_in\_new_ Learn more](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

- [x] 

 

Heading Style 

Sets markdown heading format (passed to Turndown).

Hash Style

_arrow\_drop\_down_

 

 

Horizontal Rule Style 

Defines markdown horizontal rule format (passed to Turndown).

- [x] 

 

Bullet Point Style 

Sets bullet list marker character (passed to Turndown).

*

_arrow\_drop\_down_

 

 

Emphasis Style 

Defines markdown emphasis delimiter (passed to Turndown).

_

_arrow\_drop\_down_

 

 

Strong Emphasis Style 

Sets markdown strong emphasis delimiter (passed to Turndown).

**

_arrow\_drop\_down_

 

 

Link Style 

Determines markdown link format (passed to Turndown).

Inline

_arrow\_drop\_down_

 

 

EU Compliance 

Experimental

All infrastructure and data processing operations reside entirely within EU jurisdiction.

- [x] 

 

* * *

_upload_

Request

- [x] 

GET

Bash

Language

_arrow\_drop\_down_

 

_wrap\_text_

```
curl "https://r.jina.ai/https://www.example.com"
```

_content\_copy_

* * *

_send_ GET RESPONSE

* * *

_key_

API key

This is your unique key. Store it securely!

 

## [Jina VLM: Small Multilingual Vision Language Model](https://jina.ai/reader/)

A 2.4B parameter vision-language model that achieves state-of-the-art multilingual visual question answering among open 2B-scale VLMs.

![Image 4](https://jina.ai/blog-banner/jina-vlm-small-multilingual-vision-language-model.gif)

## [ReaderLM v2: Small Language Model for HTML to Markdown and JSON](https://jina.ai/reader/)

ReaderLM-v2 is a 1.5B parameter language model specialized in HTML-to-Markdown conversion and HTML-to-JSON extraction. It supports documents up to 512K tokens across 29 languages and offers 20% higher accuracy compared to its predecessor.

![Image 5](https://jina.ai/assets/animation-readerlm-v2-BZGhT4e1.gif)

## [What is Reader?](https://jina.ai/reader/#what_reader)

![Image 6](https://jina.ai/assets/explain-EQrFe5k3.svg)

Feeding web information into LLMs is an important step of grounding, yet it can be challenging. The simplest method is to scrape the webpage and feed the raw HTML. However, scraping can be complex and often blocked, and raw HTML is cluttered with extraneous elements like markups and scripts. The Reader API addresses these issues by extracting the core content from a URL and converting it into clean, LLM-friendly text, ensuring high-quality input for your agent and RAG systems.

_casino_

Enter your URL

_open\_in\_new_

Click below to fetch the source code of the page directly

 

* * *

Reader URL

_content\_copy_ _open\_in\_new_

Click below to obtain the content through our Reader API

 

* * *

_download_ Fetch Content

* * *

Raw HTML

_content\_copy_

* * *

Reader Output

_content\_copy_

* * *

Pose a Question

_send_

Input a question and combine it with the fetched content for LLM to generate an answer

 

## [Reader for web search and SERP](https://jina.ai/reader/#search)

![Image 7](https://jina.ai/assets/explain3-CqNg2V0h.svg)

Reader can be used as SERP API. It allows you to feed your LLM with the content behind the search results engine page. Simply prepend `https://s.jina.ai/?q=` to your query, and Reader will search the web and return the top five results with their URLs and contents, each in clean, LLM-friendly text. This way, you can always keep your LLM up-to-date, improve its factuality, and reduce hallucinations.

_casino_

Enter your query

Type a question that requires latest information or world knowledge.

 

* * *

Reader URL

_content\_copy_ _open\_in\_new_

If you use this URL in code, dont forget to encode the URL.

 

* * *

_contact\_support_ Ask LLM w/o & w/ Search Grounding

* * *

_info_ Please note that unlike the demo shown above, in practice you do not search the original question on the web for grounding. What people often do is rewrite the original question or use multi-hop questions. They read the retrieved results and then generate additional queries to gather more information as needed before arriving at a final answer.

## [Reader also reads images!](https://jina.ai/reader/#read-image)

![Image 8](https://jina.ai/assets/explain2-BYDhf_rF.svg)

Images on the webpage are automatically captioned using a vision language model in the reader and formatted as image alt tags in the output. This gives your downstream LLM just enough hints to incorporate those images into its reasoning and summarizing processes. This means you can ask questions about the images, select specific ones, or even forward their URLs to a more powerful VLM for deeper analysis!

## [Reader also reads PDFs!](https://jina.ai/reader/#read-pdf)

![Image 9](https://jina.ai/assets/explain4-CPLfQrjf.png)

Yes, Reader natively supports PDF reading. It's compatible with most PDFs, including those with many images, and it's lightning fast! Combined with an LLM, you can easily build a ChatPDF or document analysis AI in no time.

[_open\_in\_new_ Original PDF](https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf)

* * *

[_open\_in\_new_ Reader Result](https://r.jina.ai/https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf)

## [The best part? It's free!](https://jina.ai/reader/)

Reader API is available for free and offers flexible rate limit and pricing. Built on a scalable infrastructure, it offers high accessibility, concurrency, and reliability. We strive to be your preferred grounding solution for your LLMs.

Rate Limit

Rate limits are tracked in three ways: **RPM** (requests per minute), and **TPM** (tokens per minute). Limits are enforced per IP/API key and will be triggered when either the RPM or TPM threshold is reached first. When you provide an API key in the request header, we track rate limits by key rather than IP address.

Columns

_arrow\_drop\_down_

 

_fullscreen_

|  | Product | API Endpoint | Description _arrow\_upward_ | w/o API Key _key\_off_ | w/ Free API Key _key_ | w/ Paid API Key _key_ | w/ Premium API Key _key_ | Average Latency | Token Usage Counting | Allowed Request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ![Image 10](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://r.jina.ai` | Convert URL to LLM-friendly text | 20 RPM | 500 RPM | 500 RPM | _trending\_up_ 5000 RPM | 7.9s | Count the number of tokens in the output response. | GET/POST |
| ![Image 11](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://s.jina.ai` | Search the web and convert results to LLM-friendly text | _block_ | 100 RPM | 100 RPM | _trending\_up_ 1000 RPM | 2.5s | Every request costs a fixed number of tokens, starting from 10000 tokens | GET/POST |
| ![Image 12](https://jina.ai/assets/embedding-DzEuY8_E.svg) | Embedding API | `https://api.jina.ai/v1/embeddings` | Convert text/images to fixed-length vectors | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 13](https://jina.ai/assets/reranker-DudpN0Ck.svg) | Reranker API | `https://api.jina.ai/v1/rerank` | Rank documents by query | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 14](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API | `https://api.jina.ai/v1/train` | Train a classifier using labeled examples | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens × num_iters | POST |
| ![Image 15](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Few-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using a trained few-shot classifier | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens | POST |
| ![Image 16](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Zero-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using zero-shot classification | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens + label_tokens | POST |
| ![Image 17](blob:http://localhost/d9cb1deb4878909b05c9cd0f15af4aac) | Segmenter API | `https://api.jina.ai/v1/segment` | Tokenize and segment long text | 20 RPM | 200 RPM | 200 RPM | 1,000 RPM | 0.3s | Token is not counted as usage. | GET/POST |
| ![Image 18](blob:http://localhost/db267ccec0291b9762c00dd4567c6a5c) | DeepSearch | `https://deepsearch.jina.ai/v1/chat/completions` | Reason, search and iterate to find the best answer | _block_ | 50 RPM | 50 RPM | 500 RPM | 56.7s | Count the total number of tokens in the whole process. | POST |

Don't panic! Every new API key contains ten millions free tokens!

_key_ Get your API key

* * *

_attach\_money_ Check the price table

## [API Pricing](https://jina.ai/reader/#pricing)

API pricing is based on the token usage. One API key gives you access to all search foundation products.

_![Image 19](https://jina.ai/J-active-light.svg)_

With Jina Search Foundation API

The easiest way to access all of our products. Top-up tokens as you go.

_key_

_content\_copy_

Enter the API key you wish to recharge

_error_

_visibility\_off_

 

_verified\_user_

Top up this API key with more tokens

Depending on your location, you may be charged in USD, EUR, or other currencies. Taxes may apply.

Toy Experiment

10 Million

Tokens valid for: 

_![Image 20](https://jina.ai/assets/reader-D06QTWF1.svg)_ _![Image 21](https://jina.ai/assets/embedding-DzEuY8\_E.svg)_ _![Image 22](https://jina.ai/assets/reranker-DudpN0Ck.svg)_ _![Image 23](blob:http://localhost/759bf87588178696cd8653665e637784)_

 Non-commercial use only (CC-BY-NC).

Free

Enjoy your new API key with free tokens, no credit card required.

Prototype Development

1 Billion

Tokens valid for: 

_![Image 24](https://jina.ai/assets/reader-D06QTWF1.svg)_ _![Image 25](https://jina.ai/assets/embedding-DzEuY8\_E.svg)_ _![Image 26](https://jina.ai/assets/reranker-DudpN0Ck.svg)_ _![Image 27](blob:http://localhost/759bf87588178696cd8653665e637784)_

_key_ Standard key

_task\_alt_ Basic key management

_task\_alt_ Technical support

$50

0.050 / 1M tokens

_add\_shopping\_cart_

Production Deployment

11 Billion

Tokens valid for: 

_![Image 28](https://jina.ai/assets/reader-D06QTWF1.svg)_ _![Image 29](https://jina.ai/assets/embedding-DzEuY8\_E.svg)_ _![Image 30](https://jina.ai/assets/reranker-DudpN0Ck.svg)_ _![Image 31](blob:http://localhost/759bf87588178696cd8653665e637784)_

_key_ Premium key with much higher rate limits

_task\_alt_ Advanced key management

_task\_alt_ Premium customer support in 24 hours

_task\_alt_ One-hour integration consultation

$500

0.045 / 1M tokens

_add\_shopping\_cart_

Please input the right API key to top up

_speed_

Understand the rate limit

Rate limits are the maximum number of requests that can be made to an API within a minute per IP address/API key (RPM). Find out more about the rate limits for each product and tier below.

_keyboard\_arrow\_down_

Rate Limit

Rate limits are tracked in three ways: **RPM** (requests per minute), and **TPM** (tokens per minute). Limits are enforced per IP/API key and will be triggered when either the RPM or TPM threshold is reached first. When you provide an API key in the request header, we track rate limits by key rather than IP address.

Columns

_arrow\_drop\_down_

 

_fullscreen_

|  | Product | API Endpoint | Description _arrow\_upward_ | w/o API Key _key\_off_ | w/ Free API Key _key_ | w/ Paid API Key _key_ | w/ Premium API Key _key_ | Average Latency | Token Usage Counting | Allowed Request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ![Image 32](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://r.jina.ai` | Convert URL to LLM-friendly text | 20 RPM | 500 RPM | 500 RPM | _trending\_up_ 5000 RPM | 7.9s | Count the number of tokens in the output response. | GET/POST |
| ![Image 33](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://s.jina.ai` | Search the web and convert results to LLM-friendly text | _block_ | 100 RPM | 100 RPM | _trending\_up_ 1000 RPM | 2.5s | Every request costs a fixed number of tokens, starting from 10000 tokens | GET/POST |
| ![Image 34](https://jina.ai/assets/embedding-DzEuY8_E.svg) | Embedding API | `https://api.jina.ai/v1/embeddings` | Convert text/images to fixed-length vectors | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 35](https://jina.ai/assets/reranker-DudpN0Ck.svg) | Reranker API | `https://api.jina.ai/v1/rerank` | Rank documents by query | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 36](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API | `https://api.jina.ai/v1/train` | Train a classifier using labeled examples | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens × num_iters | POST |
| ![Image 37](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Few-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using a trained few-shot classifier | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens | POST |
| ![Image 38](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Zero-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using zero-shot classification | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens + label_tokens | POST |
| ![Image 39](blob:http://localhost/d9cb1deb4878909b05c9cd0f15af4aac) | Segmenter API | `https://api.jina.ai/v1/segment` | Tokenize and segment long text | 20 RPM | 200 RPM | 200 RPM | 1,000 RPM | 0.3s | Token is not counted as usage. | GET/POST |
| ![Image 40](blob:http://localhost/db267ccec0291b9762c00dd4567c6a5c) | DeepSearch | `https://deepsearch.jina.ai/v1/chat/completions` | Reason, search and iterate to find the best answer | _block_ | 50 RPM | 50 RPM | 500 RPM | 56.7s | Count the total number of tokens in the whole process. | POST |

_currency\_exchange_

Auto top-up on low token balance

Recommended for uninterrupted service in production. When your token balance drops below the set threshold, we will automatically recharge your saved payment method for the last purchased package, until the threshold is met.

_info_ We introduced a new pricing model on May 6th, 2025. If you enabled auto-recharge before this date, you'll continue to pay the old price (the one when you purchased). The new pricing only applies if you modify your auto-recharge settings or purchase a new API key.

_check_

< 1M Tokens

Top up when

_arrow\_drop\_down_

 

 

## [FAQ](https://jina.ai/reader/#faq)

_![Image 41](https://jina.ai/assets/reader-D06QTWF1.svg)_

What are the costs associated with using the Reader API?

_keyboard\_arrow\_down_

Reader API is free for basic usage - simply prepend 'https://r.jina.ai/' to your URL. For higher rate limits, you can provide an API key which charges tokens based on content length. Check Q16 for rate limit details.

_![Image 42](https://jina.ai/assets/reader-D06QTWF1.svg)_

How does the Reader API function?

_keyboard\_arrow\_down_

The Reader API uses a proxy to fetch any URL, rendering its content in a browser to extract high-quality main content.

_![Image 43](https://jina.ai/assets/reader-D06QTWF1.svg)_

Is the Reader API open source?

_keyboard\_arrow\_down_

Yes, the Reader API is open source and available on the Jina AI GitHub repository.

_![Image 44](https://jina.ai/assets/reader-D06QTWF1.svg)_

What is the typical latency for the Reader API?

_keyboard\_arrow\_down_

The Reader API generally processes URLs and returns content within 2 seconds, although complex or dynamic pages might require more time.

_![Image 45](https://jina.ai/assets/reader-D06QTWF1.svg)_

Why should I use the Reader API instead of scraping the page myself?

_keyboard\_arrow\_down_

Scraping can be complicated and unreliable, particularly with complex or dynamic pages. The Reader API provides a streamlined, reliable output of clean, LLM-ready text.

_![Image 46](https://jina.ai/assets/reader-D06QTWF1.svg)_

Does the Reader API support multiple languages?

_keyboard\_arrow\_down_

The Reader API returns content in the original language of the URL. It does not provide translation services.

_![Image 47](https://jina.ai/assets/reader-D06QTWF1.svg)_

What should I do if a website blocks the Reader API?

_keyboard\_arrow\_down_

If you experience blocking issues, please contact our support team for assistance and resolution.

_![Image 48](https://jina.ai/assets/reader-D06QTWF1.svg)_

Can the Reader API extract content from PDF files?

_keyboard\_arrow\_down_

Yes, the Reader API can natively extract content from PDF files.

_![Image 49](https://jina.ai/assets/reader-D06QTWF1.svg)_

Can the Reader API process media content from web pages?

_keyboard\_arrow\_down_

Yes, Reader can caption images on webpages using the `x-with-generated-alt` header. This adds descriptive alt tags to images that lack them, enabling LLMs to understand visual content. Video summarization is planned for future releases.

_![Image 50](https://jina.ai/assets/reader-D06QTWF1.svg)_

Is it possible to use the Reader API on local HTML files?

_keyboard\_arrow\_down_

No, the Reader API can only process content from publicly accessible URLs.

_![Image 51](https://jina.ai/assets/reader-D06QTWF1.svg)_

Does Reader API cache the content?

_keyboard\_arrow\_down_

If you request the same URL within 5 minutes, the Reader API will return the cached content.

_![Image 52](https://jina.ai/assets/reader-D06QTWF1.svg)_

Can I use the Reader API to access content behind a login?

_keyboard\_arrow\_down_

Unfortunately not.

_![Image 53](https://jina.ai/assets/reader-D06QTWF1.svg)_

Can I use the Reader API to access PDF on arXiv?

_keyboard\_arrow\_down_

Yes, you can either use the native PDF support from the Reader (https://r.jina.ai/https://arxiv.org/pdf/2310.19923v4) or use the HTML version from the arXiv (https://r.jina.ai/https://arxiv.org/html/2310.19923v4)

_![Image 54](https://jina.ai/assets/reader-D06QTWF1.svg)_

How does image caption work in Reader?

_keyboard\_arrow\_down_

Reader captions all images at the specified URL and adds `Image [idx]: [caption]` as an alt tag (if they initially lack one). This enables downstream LLMs to interact with the images in reasoning, summarizing etc.

_![Image 55](https://jina.ai/assets/reader-D06QTWF1.svg)_

What is the scalability of the Reader? Can I use it in production?

_keyboard\_arrow\_down_

The Reader API is designed to be highly scalable. It is auto-scaled based on the real-time traffic and the maximum concurrency requests is now around 4000. We are maintaining it actively as one of the core products of Jina AI. So feel free to use it in production.

_![Image 56](https://jina.ai/assets/reader-D06QTWF1.svg)_

What is the rate limit of the Reader API?

_keyboard\_arrow\_down_

Please find the latest rate limit information in the table below. Note that we are actively working on improving the rate limit and performance of the Reader API, the table will be updated accordingly.

[_speed_ Rate limit](https://jina.ai/reader/#rate-limit)

_![Image 57](https://jina.ai/assets/reader-D06QTWF1.svg)_

What is Reader-LM? How can I use it?

_keyboard\_arrow\_down_

`ReaderLM-v2` is our latest small language model (SLM) for converting raw HTML into clean markdown or JSON. It offers a 3x quality improvement over v1 and can extract structured data using JSON schema or natural language instructions. You can use it directly via Reader API with the `x-respond-with: readerlm-v2` header, or deploy it from cloud marketplaces (AWS, Azure, GCP).

[_launch_ AWS SageMaker](https://aws.amazon.com/marketplace/seller-profile?id=seller-stch2ludm6vgy)[_launch_ Google Cloud](https://console.cloud.google.com/marketplace/browse?q=jina&pli=1&inv=1&invt=AbmydQ)[_launch_ Microsoft Azure](https://azuremarketplace.microsoft.com/en-US/marketplace/apps?page=1&search=jina)

_![Image 58](https://jina.ai/assets/reader-D06QTWF1.svg)_

How do I extract structured data from webpages?

_keyboard\_arrow\_down_

Use the `x-json-schema` header with a JSON schema definition, or use `x-instruction` header with natural language instructions. Both features work with ReaderLM-v2 to extract specific fields like prices, titles, dates, etc. from any webpage into structured JSON format.

_![Image 59](https://jina.ai/assets/reader-D06QTWF1.svg)_

Does Reader actively bypass website anti-bot protection?

_keyboard\_arrow\_down_

No. Reader does not actively circumvent or bypass any website defense mechanisms, anti-bot systems, or access controls. If a website detects our service as a bot and blocks the request, that outcome is respected. We operate as a standard web client and do not employ techniques designed to evade detection systems.

_![Image 60](https://jina.ai/assets/reader-D06QTWF1.svg)_

Will upgrading from a free to a paid API key give me access to more websites?

_keyboard\_arrow\_down_

No. Upgrading from a free tier to a paid API key does not grant access to additional websites or bypass any site restrictions. The difference between tiers is primarily in rate limits and performance optimizations. A paid API key provides higher request throughput and faster processing, but it does not enable access to websites that block our service.

### [How to get my API key?](https://jina.ai/reader/#get-api-key)

[Video 2](https://cms.jina.ai/content/media/2024/10/jina-ai-rate-limit.mp4)

### [What's the rate limit?](https://jina.ai/reader/#rate-limit)

Rate Limit

Rate limits are tracked in three ways: **RPM** (requests per minute), and **TPM** (tokens per minute). Limits are enforced per IP/API key and will be triggered when either the RPM or TPM threshold is reached first. When you provide an API key in the request header, we track rate limits by key rather than IP address.

Columns

_arrow\_drop\_down_

 

_fullscreen_

|  | Product | API Endpoint | Description _arrow\_upward_ | w/o API Key _key\_off_ | w/ Free API Key _key_ | w/ Paid API Key _key_ | w/ Premium API Key _key_ | Average Latency | Token Usage Counting | Allowed Request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ![Image 61](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://r.jina.ai` | Convert URL to LLM-friendly text | 20 RPM | 500 RPM | 500 RPM | _trending\_up_ 5000 RPM | 7.9s | Count the number of tokens in the output response. | GET/POST |
| ![Image 62](https://jina.ai/assets/reader-D06QTWF1.svg) | Reader API | `https://s.jina.ai` | Search the web and convert results to LLM-friendly text | _block_ | 100 RPM | 100 RPM | _trending\_up_ 1000 RPM | 2.5s | Every request costs a fixed number of tokens, starting from 10000 tokens | GET/POST |
| ![Image 63](https://jina.ai/assets/embedding-DzEuY8_E.svg) | Embedding API | `https://api.jina.ai/v1/embeddings` | Convert text/images to fixed-length vectors | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 64](https://jina.ai/assets/reranker-DudpN0Ck.svg) | Reranker API | `https://api.jina.ai/v1/rerank` | Rank documents by query | _block_ | 100 RPM & 100,000 TPM | 500 RPM & 2,000,000 TPM | _trending\_up_ 5,000 RPM & 50,000,000 TPM | _ssid\_chart_ depends on the input size _help_ | Count the number of tokens in the input request. | POST |
| ![Image 65](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API | `https://api.jina.ai/v1/train` | Train a classifier using labeled examples | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens × num_iters | POST |
| ![Image 66](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Few-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using a trained few-shot classifier | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens | POST |
| ![Image 67](blob:http://localhost/47430e9cbced04c539a17eb39573e3a9) | Classifier API (Zero-shot) | `https://api.jina.ai/v1/classify` | Classify inputs using zero-shot classification | _block_ | 25 RPM & 25,000 TPM | 125 RPM & 500,000 TPM | 1,250 RPM & 12,000,000 TPM | _ssid\_chart_ depends on the input size | Tokens counted as: input_tokens + label_tokens | POST |
| ![Image 68](blob:http://localhost/d9cb1deb4878909b05c9cd0f15af4aac) | Segmenter API | `https://api.jina.ai/v1/segment` | Tokenize and segment long text | 20 RPM | 200 RPM | 200 RPM | 1,000 RPM | 0.3s | Token is not counted as usage. | GET/POST |
| ![Image 69](blob:http://localhost/db267ccec0291b9762c00dd4567c6a5c) | DeepSearch | `https://deepsearch.jina.ai/v1/chat/completions` | Reason, search and iterate to find the best answer | _block_ | 50 RPM | 50 RPM | 500 RPM | 56.7s | Count the total number of tokens in the whole process. | POST |

API-related common questions

_code_

Can I use the same API key for reader, embedding, reranking, classifying and fine-tuning APIs?

_keyboard\_arrow\_down_

Yes, the same API key is valid for all search foundation products from Jina AI. This includes the reader, embedding, reranking, classifying and fine-tuning APIs, with tokens shared between the all services.

_code_

Can I monitor the token usage of my API key?

_keyboard\_arrow\_down_

Yes, token usage can be monitored in the 'API Key & Billing' tab by entering your API key, allowing you to view the recent usage history and remaining tokens. If you have logged in to the API dashboard, these details can also be viewed in the 'Manage API Key' tab.

_code_

What should I do if I forget my API key?

_keyboard\_arrow\_down_

If you have misplaced a topped-up key and wish to retrieve it, please contact support AT jina.ai with your registered email for assistance. It's recommended to log in to keep your API key securely stored and easily accessible.

[Contact](https://jina.ai/contact-sales)

_code_

Do API keys expire?

_keyboard\_arrow\_down_

No, our API keys do not have an expiration date. However, if you suspect your key has been compromised and wish to retire it, please contact our support team for assistance. You can also revoke your key in [the API Key Management dashboard](https://jina.ai/api-dashboard).

[Contact](https://jina.ai/contact-sales)

_code_

Can I transfer tokens between API keys?

_keyboard\_arrow\_down_

Yes, you can transfer tokens from a premium key to another. After logging into your account on [the API Key Management dashboard](https://jina.ai/api-dashboard), use the settings of the key you want to transfer out to move all remaining paid tokens.

_code_

Can I revoke my API key?

_keyboard\_arrow\_down_

Yes, you can revoke your API key if you believe it has been compromised. Revoking a key will immediately disable it for all users who have stored it, and all remaining balance and associated properties will be permanently unusable. If the key is a premium key, you have the option to transfer the remaining paid balance to another key before revocation. Notice that this action cannot be undone. To revoke a key, go to the key settings in [the API Key Management dashboard](https://jina.ai/api-dashboard).

_code_

Why is the first request for some models slow?

_keyboard\_arrow\_down_

This is because our serverless architecture offloads certain models during periods of low usage. The initial request activates or 'warms up' the model, which may take a few seconds. After this initial activation, subsequent requests process much more quickly.

_code_

Is my API data used to train your models?

_keyboard\_arrow\_down_

No. We never use your API requests, inputs, or outputs to train our embedding, reranker, or any other models. Your data remains yours.

_code_

What are the rate limits for Jina APIs?

_keyboard\_arrow\_down_

Rate limits apply per API key:

**Free:** 100 RPM, 100K TPM, 2 concurrent requests

**Paid:** 500 RPM, 2M TPM, 50 concurrent requests

**Premium:** 5,000 RPM, 50M TPM, 500 concurrent requests

There is also an IP-based rate limit of 10,000 requests per 60 seconds. These limits apply across all Jina APIs (Embeddings, Reranker, Reader, etc.).

_code_

Are there batch size limits for the APIs?

_keyboard\_arrow\_down_

There is **no batch size limit** for either the Embeddings or Reranker APIs. You can send as many items or documents as needed per request. Both APIs batch inputs internally by token count for optimal GPU utilization.

Billing-related common questions

_attach\_money_

Is billing based on the number of sentences or requests?

_keyboard\_arrow\_down_

Our pricing model is based on the total number of tokens processed, allowing users the flexibility to allocate these tokens across any number of sentences, offering a cost-effective solution for diverse text analysis requirements.

_attach\_money_

Is there a free trial available for new users?

_keyboard\_arrow\_down_

We offer a welcoming free trial to new users, which includes ten millions tokens for use with any of our models, facilitated by an auto-generated API key. Once the free token limit is reached, users can easily purchase additional tokens for their API keys via the 'Buy tokens' tab.

_attach\_money_

Are tokens charged for failed requests?

_keyboard\_arrow\_down_

No, tokens are not deducted for failed requests.

_attach\_money_

What payment methods are accepted?

_keyboard\_arrow\_down_

Payments are processed through Stripe, supporting a variety of payment methods including credit cards, Google Pay, and PayPal for your convenience.

_attach\_money_

Is invoicing available for token purchases?

_keyboard\_arrow\_down_

Yes, an invoice will be issued to the email address associated with your Stripe account upon the purchase of tokens.

Search Foundation

[Reader](https://jina.ai/reader)[Embeddings](https://jina.ai/embeddings)[Reranker](https://jina.ai/reranker)[Elastic Inference Service _open\_in\_new_](https://www.elastic.co/docs/explore-analyze/elastic-inference/eis)

Get Jina API key

[Rate Limit](https://jina.ai/contact-sales#rate-limit)[API Status](https://status.jina.ai/)

Company

[About us](https://jina.ai/about-us)[Contact sales](https://jina.ai/contact-sales)[News](https://jina.ai/news)[Intern program](https://jina.ai/internship)[Download Jina logo _open\_in\_new_](https://jina.ai/logo-Jina-1024.zip)[Download Elastic logo _open\_in\_new_](https://brand.elastic.co/302f66895/p/06c73c-elastic-logos/b/35d033)

Terms

[Security](https://jina.ai/legal#security-as-company-value)[Terms & Conditions](https://jina.ai/legal/#terms-and-conditions)[Privacy](https://jina.ai/legal/#privacy-policy)[Manage Cookies](javascript:UC_UI.showSecondLayer();)

[](https://x.com/jinaAI_)[](https://www.linkedin.com/company/jinaai/)[](https://github.com/jina-ai)[_![Image 70](https://jina.ai/huggingface\_logo.svg)_](https://huggingface.co/jinaai)[_email_](mailto:support@jina.ai)

Elastic © 2020-2026.
