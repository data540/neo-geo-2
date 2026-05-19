---
title: "Perplexity Crawlers - Perplexity"
description: "We strive to improve our service every day by delivering the best search experience possible. To achieve this, we collect data using web crawlers (\"robots\") and user agents that gather and index information from the internet, operating either automatically or in response to user requests. Webmasters can use the following robots.txt tags to manage how their sites and content interact with Perplexity. Each setting works independently, and it may take up to 24 hours for our systems to reflect changes."
url: "https://docs.perplexity.ai/docs/resources/perplexity-crawlers"
publishedTime: "Mon, 18 May 2026 18:22:27 GMT"
---

[Skip to main content](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#content-area)

For AI agents: see the complete [llms.txt](https://docs.perplexity.ai/llms.txt) documentation index.

[Perplexity home page![Image 1: light logo](https://mintcdn.com/perplexity/gHf_T6roVjp3yaJv/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=gHf_T6roVjp3yaJv&q=85&s=07cab879ca2ce031bbc3da8b20f7ab90)![Image 2: dark logo](https://mintcdn.com/perplexity/gHf_T6roVjp3yaJv/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=gHf_T6roVjp3yaJv&q=85&s=416d5342d11094201b851dcf3eabdc9d)](https://docs.perplexity.ai/docs/getting-started/overview)

[Docs](https://docs.perplexity.ai/docs/getting-started/overview)[Cookbook](https://docs.perplexity.ai/docs/cookbook)[API Reference](https://docs.perplexity.ai/api-reference/agent-post)

Search...

Navigation

Resources

Perplexity Crawlers

Search

Ctrl K

*   [Community](https://community.perplexity.ai/)
*   [Blog](https://research.perplexity.ai/articles)
*   [Changelog](https://docs.perplexity.ai/docs/resources/changelog)

##### Getting Started

*   [Overview](https://docs.perplexity.ai/docs/getting-started/overview)
*   [Quickstart](https://docs.perplexity.ai/docs/getting-started/quickstart)
*   [Pricing](https://docs.perplexity.ai/docs/getting-started/pricing)
*   Integrations  

##### Perplexity SDK

*   [Quickstart](https://docs.perplexity.ai/docs/sdk/overview)
*   Guides  

##### Agent API

*   [Quickstart](https://docs.perplexity.ai/docs/agent-api/quickstart)
*   Models & Configuration  
*   [Prompt Guide](https://docs.perplexity.ai/docs/agent-api/prompt-guide)
*   Features  
*   [OpenAI Compatibility](https://docs.perplexity.ai/docs/agent-api/openai-compatibility)

##### Search API

*   [Quickstart](https://docs.perplexity.ai/docs/search/quickstart)
*   [Best Practices](https://docs.perplexity.ai/docs/search/best-practices)
*   Filters  

##### Sonar API

*   [Quickstart](https://docs.perplexity.ai/docs/sonar/quickstart)
*   [Models](https://docs.perplexity.ai/docs/sonar/models)
*   [Prompt Guide](https://docs.perplexity.ai/docs/sonar/prompt-guide)
*   Features  
*   Pro Search  
*   [OpenAI SDK Compatibility](https://docs.perplexity.ai/docs/sonar/openai-compatibility)

##### Embeddings API

*   [Quickstart](https://docs.perplexity.ai/docs/embeddings/quickstart)
*   [Best Practices](https://docs.perplexity.ai/docs/embeddings/best-practices)
*   [Standard Embeddings](https://docs.perplexity.ai/docs/embeddings/standard-embeddings)
*   [Contextualized Embeddings](https://docs.perplexity.ai/docs/embeddings/contextualized-embeddings)

##### Admin & Management

*   [API Groups & Billing](https://docs.perplexity.ai/docs/getting-started/api-groups)
*   [API Key Management](https://docs.perplexity.ai/docs/admin/api-key-management)
*   [Rate Limits & Usage Tiers](https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers)
*   [AWS Marketplace](https://docs.perplexity.ai/docs/resources/aws-marketplace)

##### Resources

*   [API Roadmap](https://docs.perplexity.ai/docs/resources/feature-roadmap)
*   [Privacy & Security](https://docs.perplexity.ai/docs/resources/privacy-security)
*   [Frequently Asked Questions](https://docs.perplexity.ai/docs/resources/faq)
*   [System Status](https://docs.perplexity.ai/docs/resources/status)
*   [Changelog](https://docs.perplexity.ai/docs/resources/changelog)
*   [Get in Touch](https://docs.perplexity.ai/docs/resources/discussions)
*   [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

On this page

*   [WAF Configuration](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#waf-configuration)
*   [Cloudflare WAF](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#cloudflare-waf)
*   [AWS WAF](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#aws-waf)
*   [IP Address Sources](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#ip-address-sources)
*   [Best Practices](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#best-practices)

Resources

# Perplexity Crawlers

Copy page

We strive to improve our service every day by delivering the best search experience possible. To achieve this, we collect data using web crawlers (“robots”) and user agents that gather and index information from the internet, operating either automatically or in response to user requests. Webmasters can use the following robots.txt tags to manage how their sites and content interact with Perplexity. Each setting works independently, and it may take up to 24 hours for our systems to reflect changes.

Copy page

> ## Documentation Index
> 
> 
> Fetch the complete documentation index at: [https://docs.perplexity.ai/llms.txt](https://docs.perplexity.ai/llms.txt)
> 
> 
> Use this file to discover all available pages before exploring further.

| User Agent | Description |
| --- | --- |
| PerplexityBot | `PerplexityBot` is designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models. To ensure your site appears in search results, we recommend allowing `PerplexityBot` in your site’s `robots.txt` file and permitting requests from our published IP ranges listed below. Full user-agent string: `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)` Published IP addresses: [https://www.perplexity.com/perplexitybot.json](https://www.perplexity.com/perplexitybot.json) |
| Perplexity‑User | `Perplexity-User` supports user actions within Perplexity. When users ask Perplexity a question, it might visit a web page to help provide an accurate answer and include a link to the page in its response. `Perplexity-User` controls which sites these user requests can access. It is not used for web crawling or to collect content for training AI foundation models. Full user-agent string: `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)` Published IP addresses: [https://www.perplexity.com/perplexity-user.json](https://www.perplexity.com/perplexity-user.json) Since a user requested the fetch, this fetcher generally ignores robots.txt rules. |

## [​](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#waf-configuration)

WAF Configuration

If you’re using a Web Application Firewall (WAF) to protect your site, you may need to explicitly whitelist Perplexity’s bots to ensure they can access your content. Below are configuration guidelines for popular WAF providers.
### [​](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#cloudflare-waf)

Cloudflare WAF

To configure Cloudflare WAF to allow Perplexity bots:

1

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Navigate to WAF settings

In your Cloudflare dashboard, go to **Security** → **WAF**.

2

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Create a new rule

Click on **Custom rules** and create a new rule to allow Perplexity bots.

3

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Configure rule conditions

Set up a rule that combines both User-Agent and IP address conditions:
*   **Field**: User Agent
*   **Operator**: Contains
*   **Value**: `PerplexityBot` OR `Perplexity-User`

**AND**
*   **Field**: IP Source Address
*   **Operator**: Is in
*   **Value**: Use the IP ranges from the official endpoints listed below

4

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Set rule action

Set the action to **Allow** to ensure these requests bypass other security rules.

### [​](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#aws-waf)

AWS WAF

For AWS WAF configuration, create IP sets and string match conditions:

1

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Create IP sets

In the AWS WAF console, create IP sets for both PerplexityBot and Perplexity-User using the IP addresses from the official endpoints listed below.

2

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Create string match conditions

Create string match conditions for the User-Agent headers:
*   `PerplexityBot`
*   `Perplexity-User`

3

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Create allow rules

Create rules that combine the IP sets with the corresponding User-Agent strings, and set the action to **Allow**.

4

[](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#)

Associate with Web ACL

Associate these rules with your Web ACL and ensure they have higher priority than blocking rules.

### [​](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#ip-address-sources)

IP Address Sources

Always use the most current IP ranges from the official JSON endpoints. These addresses are updated regularly and should be the source of truth for your WAF configurations.

*   **PerplexityBot IP addresses**: [https://www.perplexity.com/perplexitybot.json](https://www.perplexity.com/perplexitybot.json)
*   **Perplexity-User IP addresses**: [https://www.perplexity.com/perplexity-user.json](https://www.perplexity.com/perplexity-user.json)

Set up automated processes to periodically fetch and update your WAF rules with the latest IP ranges from these endpoints to ensure continuous access for Perplexity bots.

### [​](https://docs.perplexity.ai/docs/resources/perplexity-crawlers#best-practices)

Best Practices

When configuring WAF rules for Perplexity bots, combine both User-Agent string matching and IP address verification for enhanced security while ensuring legitimate bot traffic can access your content.

Changes to WAF configurations may take some time to propagate. Monitor your logs to ensure the rules are working as expected and that legitimate Perplexity bot traffic is being allowed through.

Was this page helpful?

Yes No

[Get in Touch Previous](https://docs.perplexity.ai/docs/resources/discussions)

Ctrl+I

[x](https://x.com/PPLXDevs)[discord](https://discord.com/invite/perplexity-ai)[website](https://community.perplexity.ai/)

[Powered by This documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=perplexity)

Assistant

Responses are generated using AI and may contain mistakes.

Suggestions

What is the Agent API?Which Agent API model should I use?How do I create an API key?
