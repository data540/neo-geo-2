---
title: "Perplexity is using stealth, undeclared crawlers to evade website no-crawl directives"
description: "Perplexity is repeatedly modifying their user agent and changing IPs and ASNs to hide their crawling activity, in direct conflict with explicit no-crawl preferences expressed by websites."
url: "https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/"
publishedTime: "2025-08-04T14:00+01:00"
---

2025-08-04

5 min read

![Image 1](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/5MASs8Vb8NUgKEKxHQEBiz/a6983d0188bf0279b82af7134905da6c/image6.png)

We are observing stealth crawling behavior from Perplexity, an AI-powered answer engine. Although Perplexity initially crawls from their declared user agent, when they are presented with a network block, they appear to obscure their crawling identity in an attempt to circumvent the website’s preferences. We see continued evidence that Perplexity is repeatedly modifying their user agent and changing their source [ASNs](https://www.cloudflare.com/learning/network-layer/what-is-an-autonomous-system/) to hide their crawling activity, as well as ignoring — or sometimes failing to even fetch — [robots.txt](https://www.cloudflare.com/learning/bots/what-is-robots-txt/)files.

The Internet as we have known it for the past three decades is [rapidly changing](https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/), but one thing remains constant: it is built on trust. There are clear preferences that crawlers should be transparent, serve a clear purpose, perform a specific activity, and, most importantly, follow website directives and preferences. Based on Perplexity’s observed behavior, which is incompatible with those preferences, we have de-listed them as a verified [bot](https://www.cloudflare.com/learning/bots/what-is-a-bot/) and added heuristics to our managed rules that [block this stealth crawling](https://www.cloudflare.com/learning/ai/how-to-block-ai-crawlers/).

### How we tested

We received complaints from customers who had both disallowed Perplexity crawling activity in their `robots.txt` files and also created [WAF rules](https://www.cloudflare.com/learning/ddos/glossary/web-application-firewall-waf/) to specifically block both of Perplexity’s [declared crawlers](https://docs.perplexity.ai/guides/bots): `PerplexityBot` and `Perplexity-User`. These customers told us that Perplexity was still able to access their content even when they saw its bots successfully blocked. We confirmed that Perplexity’s crawlers were in fact being blocked on the specific pages in question, and then performed several targeted tests to confirm what exact behavior we could observe.

We created multiple brand-new [domains](https://www.cloudflare.com/learning/dns/glossary/what-is-a-domain-name/), similar to `testexample.com` and `secretexample.com`. These domains were newly purchased and had not yet been indexed by any search engine nor made publicly accessible in any discoverable way. We implemented a `robots.txt` file with directives to stop any respectful bots from accessing any part of a website:

![Image 2: robots.txt file on our text website](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/66QyzKuX9DQqQYPvCZpw4m/78e7bbd4ff79dd2f1523e70ef54dab9e/BLOG-2879_-_2.png)
We conducted an experiment by querying Perplexity AI with questions about these domains, and discovered Perplexity was still providing detailed information regarding the exact content hosted on each of these restricted domains. This response was unexpected, as we had taken all necessary precautions to prevent this data from being retrievable by their [crawlers](https://www.cloudflare.com/learning/bots/what-is-a-web-crawler/).

![Image 3: Perplexity answering questions about our test website that should have not been accessible by Perplexity](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/08ZLg0OE7vX8x35f9rDeg/a3086959793ac565b329fbbab5e52d1e/BLOG-2879_-_3.png)![Image 4: Perplexity not checking for the presence of a robots.txt file](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/5uHc0gooXlr98LB56KBb3g/b7dae5987a64f2442d1f89cf21e974ba/BLOG-2879_-_4.png)
### Obfuscating behavior observed

**Bypassing Robots.txt and undisclosed IPs/User Agents**

Our multiple test domains explicitly prohibited all automated access by specifying in robots.txt and had specific WAF rules that blocked crawling from [Perplexity’s public crawlers](https://docs.perplexity.ai/guides/bots).We observed that Perplexity uses not only their declared user-agent, but also a generic browser intended to impersonate Google Chrome on macOS when their declared crawler was blocked.

Declared Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)20-25m daily requests
Stealth Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 3-6m daily requests

Both their declared and undeclared crawlers were attempting to access the content for scraping contrary to the web crawling norms as outlined in RFC [9309](https://datatracker.ietf.org/doc/html/rfc9309).

This undeclared crawler utilized multiple IPs not listed in [Perplexity’s official IP range](https://docs.perplexity.ai/guides/bots), and would rotate through these IPs in response to the restrictive robots.txt policy and block from Cloudflare. In addition to rotating IPs, we observed requests coming from different ASNs in attempts to further evade website blocks. This activity was observed across tens of thousands of domains and millions of requests per day. We were able to fingerprint this crawler using a combination of [machine learning](https://www.cloudflare.com/learning/ai/what-is-machine-learning/) and network signals.

An example:

![Image 5: Perplexity crawling workflow based on observations](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/4UKtFs1UPddDh9OCtMuwzC/bcdabf5fdd9b0d029581b14a90714d91/unnamed.png)
Of note: when the stealth crawler was successfully blocked, we observed that Perplexity uses other data sources — including other websites — to try to create an answer. However, these answers were less specific and lacked details from the original content, reflecting the fact that the block had been successful.

## How well-meaning bot operators respect website preferences

In contrast to the behavior described above, the Internet has expressed clear preferences on how good crawlers should behave. All well-intentioned crawlers acting in good faith should:

**Be transparent**. Identify themselves honestly, using a unique user-agent, a declared list of IP ranges or [Web Bot Auth](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/web-bot-auth/) integration, and provide contact information if something goes wrong.

**Be well-behaved netizens**. Don’t flood sites with excessive traffic, [scrape](https://www.cloudflare.com/learning/bots/what-is-data-scraping/) sensitive data, or use stealth tactics to try and dodge detection.

**Serve a clear purpose**. Whether it’s powering a voice assistant, checking product prices, or making a website more accessible, every bot has a reason to be there. The purpose should be clearly and precisely defined and easy for site owners to look up publicly.

**Separate bots for separate activities**. Perform each activity from a unique bot. This makes it easy for site owners to decide which activities they want to allow. Don’t force site owners to make an all-or-nothing decision.

**Follow the rules**. That means checking for and respecting website signals like `robots.txt`, staying within rate limits, and never bypassing security protections.

More details are outlined in our official [Verified Bots Policy Developer Docs](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/).

OpenAI is an example of a leading AI company that follows these best practices. They clearly [outline their crawlers and](https://platform.openai.com/docs/bots)give detailed explanations for each crawler’s purpose. They respect robots.txt and do not try to evade either a robots.txt directive or a network level block. And [ChatGPT Agent](https://openai.com/index/introducing-chatgpt-agent/) is signing http requests using the newly proposed open standard [Web Bot Auth](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/web-bot-auth/).

When we ran the same test as outlined above with ChatGPT, we found that ChatGPT-User fetched the robots file and stopped crawling when it was disallowed. We did not observe follow-up crawls from any other user agents or third party bots. When we removed the disallow directive from the robots entry, but presented ChatGPT with a block page, they again stopped crawling, and we saw no additional crawl attempts from other user agents. Both of these demonstrate the appropriate response to website owner preferences.

![Image 6: BLOG-2879 - 6](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/HMJjS7DRmu4octZ99HX8K/753966a88476f80d7a981b1c135fd251/BLOG-2879_-_6.png)
## How can you protect yourself?

All the undeclared crawling activity that we observed from Perplexity’s hidden User Agent was scored by our [bot management system](https://www.cloudflare.com/application-services/products/bot-management/)as a bot and was unable to pass managed challenges. Any bot management customer who has an existing block rule in place is already protected. Customers who don’t want to block traffic can set up rules to [challenge requests](https://developers.cloudflare.com/waf/custom-rules/use-cases/challenge-bad-bots/), giving real humans an opportunity to proceed. Customers with existing challenge rules are already protected. Lastly, we added signature matches for the stealth crawler into our [managed rule](https://developers.cloudflare.com/bots/concepts/bot/#ai-bots) that [blocks AI crawling activity](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/). This rule is available to all customers, including our free customers.

## What’s next?

It's been just over a month since we announced [Content Independence Day](https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/), giving content creators and publishers more control over how their content is accessed. Today, over two and a half million websites have chosen to completely disallow AI training through our managed robots.txt feature or our [managed rule blocking AI Crawlers](https://developers.cloudflare.com/bots/concepts/bot/#ai-bots). Every Cloudflare customer is now able to selectively decide which declared AI crawlers are able to access their content in accordance with their business objectives.

We expected a change in bot and crawler behavior based on these new features, and we expect that the techniques bot operators use to evade detection will continue to evolve. Once this post is live the behavior we saw will almost certainly change, and the methods we use to stop them will keep evolving as well.

Cloudflare is actively working with technical and policy experts around the world, like the IETF efforts to standardize [extensions to robots.txt](https://ietf-wg-aipref.github.io/drafts/draft-ietf-aipref-vocab.html?cf_target_id=_blank), to establish clear and measurable principles that well-meaning bot operators should abide by. We think this is an important next step in this quickly evolving space.

![Image 7: BLOG-2879 - 7](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/25VWBDa33UWxDOtqEVEx5o/41eb4ddc262551b83179c1c23a9cb1e6/BLOG-2879_-_7.png)

[Cloudforce One](https://blog.cloudflare.com/tag/cloudforce-one/)[Threat Intelligence](https://blog.cloudflare.com/tag/threat-intelligence/)[AI Bots](https://blog.cloudflare.com/tag/ai-bots/)[Bots](https://blog.cloudflare.com/tag/bots/)[AI](https://blog.cloudflare.com/tag/ai/)[Bot Management](https://blog.cloudflare.com/tag/bot-management/)[Security](https://blog.cloudflare.com/tag/security/)[Generative AI](https://blog.cloudflare.com/tag/generative-ai/)

Related posts

May 18, 2026

## [Project Glasswing: what Mythos showed us](https://blog.cloudflare.com/cyber-frontier-models/)
In recent weeks, we pointed Mythos and other security-focused LLMs at live code across critical parts of our infrastructure. We share what we observed, the models’ strengths and weaknesses, and what the work around them needs to look like before any of it can scale....

By

May 07, 2026

## [How Cloudflare responded to the “Copy Fail” Linux vulnerability](https://blog.cloudflare.com/copy-fail-linux-vulnerability-mitigation/)
When a critical Linux kernel privilege escalation was publicly disclosed, Cloudflare's security and engineering teams detected, investigated, and mitigated the threat across our global fleet, confirming zero customer impact and no malicious exploitation....

By

April 30, 2026

## [Post-quantum encryption for Cloudflare IPsec is generally available](https://blog.cloudflare.com/post-quantum-ipsec/)
Cloudflare IPsec now has generally available support for post-quantum encryption via hybrid ML-KEM. We’ve confirmed interoperability with Cisco and Fortinet....

By

April 30, 2026

## [Agents can now create Cloudflare accounts, buy domains, and deploy](https://blog.cloudflare.com/agents-stripe-projects/)
Starting today, agents can now be Cloudflare customers. They can create a Cloudflare account, start a paid subscription, register a domain, and get back an API token to deploy code right away. Humans can be in the loop to grant permission, but there’s no need to go to the dashboard, copy and paste API tokens, or enter credit card details. ...

By
