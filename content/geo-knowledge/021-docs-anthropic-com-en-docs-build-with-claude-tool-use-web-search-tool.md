---
title: "Web search tool"
description: "Claude API Documentation"
url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool"
---

Messages Tools

The web search tool gives Claude direct access to real-time web content, allowing it to answer questions with up-to-date information beyond its knowledge cutoff. The response includes citations for sources drawn from search results.

The latest web search tool version (`web_search_20260209`) supports **dynamic filtering** with [Claude Mythos Preview](https://anthropic.com/glasswing), Claude Opus 4.7, Claude Opus 4.6, and Claude Sonnet 4.6. Claude can write and execute code to filter search results before they reach the context window, keeping only relevant information and discarding the rest. This leads to more accurate responses while reducing token consumption. The previous tool version (`web_search_20250305`) remains available without dynamic filtering.

For [Claude Mythos Preview](https://anthropic.com/glasswing), web search is supported on the Claude API, Microsoft Foundry, and Vertex AI. Web search is not available for Mythos Preview on Amazon Bedrock or [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws).

For Zero Data Retention eligibility and the `allowed_callers` workaround, see [Server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools#zdr-and-allowed-callers).

For model support, see the [Tool reference](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference).

## How web search works

When you add the web search tool to your API request:

1.   Claude decides when to search based on the prompt.
2.   The API executes the searches and provides Claude with the results. This process may repeat multiple times throughout a single request.
3.   At the end of its turn, Claude provides a final response with cited sources.

### Dynamic filtering

Web search is a token-intensive task. With basic web search, Claude needs to pull search results into context, fetch full HTML from multiple websites, and reason over all of it before arriving at an answer. Often, much of this content is irrelevant, which can degrade response quality.

With the `web_search_20260209` tool version, Claude can write and execute code to post-process query results. Instead of reasoning over full HTML files, Claude dynamically filters search results before loading them into context, keeping only what's relevant and discarding the rest.

Dynamic filtering is particularly effective for:

*   Searching through technical documentation
*   Literature review and citation verification
*   Technical research
*   Response grounding and verification

Dynamic filtering requires the [code execution tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool) to be enabled. The web search tool (with and without dynamic filtering) is available on the Claude API, [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws), and [Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry). On Vertex AI, only the basic web search tool (without dynamic filtering) is available. Web search is not available on Amazon Bedrock.

To enable dynamic filtering, use the `web_search_20260209` tool version:

## How to use web search

Your organization's administrator must enable web search in the [Claude Console](https://platform.claude.com/settings/privacy).

Provide the web search tool in your API request:

### Tool definition

The web search tool supports the following parameters:

#### Max uses

The `max_uses` parameter limits the number of searches performed. If Claude attempts more searches than allowed, the `web_search_tool_result` is an error with the `max_uses_exceeded` error code.

#### Domain filtering

For domain filtering with `allowed_domains` and `blocked_domains`, see [Server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools#domain-filtering).

#### Localization

The `user_location` parameter allows you to localize search results based on a user's location.

*   `type`: The type of location (must be `approximate`)
*   `city`: The city name
*   `region`: The region or state
*   `country`: The country
*   `timezone`: The [IANA timezone ID](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

### Response

Here's an example response structure:

#### Search results

Search results include:

*   `url`: The URL of the source page
*   `title`: The title of the source page
*   `page_age`: When the site was last updated
*   `encrypted_content`: Encrypted content that must be passed back in multi-turn conversations for citations

#### Citations

Citations are always enabled for web search, and each `web_search_result_location` includes:

*   `url`: The URL of the cited source
*   `title`: The title of the cited source
*   `encrypted_index`: A reference that must be passed back for multi-turn conversations.
*   `cited_text`: Up to 150 characters of the cited content

The web search citation fields `cited_text`, `title`, and `url` do not count towards input or output token usage.

When displaying API outputs directly to end users, citations must be included to the original source. If you are making modifications to API outputs, including by reprocessing and/or combining them with your own material before displaying them to end users, display citations as appropriate based on consultation with your legal team.

#### Errors

When the web search tool encounters an error (such as hitting rate limits), the Claude API still returns a 200 (success) response. The error is represented within the response body using the following structure:

These are the possible error codes:

*   `too_many_requests`: Rate limit exceeded
*   `invalid_input`: Invalid search query parameter
*   `max_uses_exceeded`: Maximum web search tool uses exceeded
*   `query_too_long`: Query exceeds maximum length
*   `unavailable`: An internal error occurred

#### `pause_turn` stop reason

For continuing after a `pause_turn` stop reason, see [Server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools#the-server-side-loop-and-pause-turn).

## Prompt caching

For caching tool definitions across turns, see [Tool use with prompt caching](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching).

## Streaming

With streaming enabled, you'll receive search events as part of the stream. There will be a pause while the search executes:

## Batch requests

You can include the web search tool in the [Messages Batches API](https://platform.claude.com/docs/en/build-with-claude/batch-processing). Web search tool calls through the Messages Batches API are priced the same as those in regular Messages API requests.

## Usage and pricing

Web search usage is charged in addition to token usage:

Web search is available on the Claude API for **$10 per 1,000 searches**, plus standard token costs for search-generated content. Web search results retrieved throughout a conversation are counted as input tokens, in search iterations executed during a single turn and in subsequent conversation turns.

Each web search counts as one use, regardless of the number of results returned. If an error occurs during web search, the web search will not be billed.

## Next steps

Was this page helpful?
