---
title: "llms.txt Documentation: Complete Specification & Format Guide"
description: "llms.txt documentation and specification guide. Learn the official llms.txt format, file structure, and how to create AI-optimized documentation for ChatGPT, Claude & Perplexity."
url: "https://llmstxtgenerator.org/llmstxt-documentation"
publishedTime: "2025-01-15"
---

## Overview

**llms.txt** is a proposal to standardise on using an `/llms.txt` file to provide information to help LLMs use a website at inference time.

The llms.txt file is a markdown document placed at your website's root that tells AI systems like ChatGPT, Claude, Perplexity, and Gemini what your website is about. It provides a clean, structured summary that AI can easily parse and understand.

Think of it as **robots.txt for AI** — while robots.txt tells search engines what to crawl, llms.txt tells language models what your site actually contains and how to interpret it.

## Background

Large language models increasingly rely on website information, but face a critical limitation: **context windows are too small** to handle most websites in their entirety. Converting complex HTML pages with navigation, ads, and JavaScript into LLM-friendly plain text is both difficult and imprecise.

While websites serve both human readers and LLMs, the latter benefit from more concise, expert-level information gathered in a single, accessible location. This is particularly important for use cases like development environments, where LLMs need quick access to programming documentation and APIs.

### Why llms.txt exists

*   •Modern websites are filled with navigation, popups, and complex layouts that confuse AI
*   •AI context windows can't fit entire websites, so they need curated summaries
*   •Without structured data, AI guesses about your business — often incorrectly
*   •llms.txt provides a single source of truth for AI systems to reference

## The llms.txt Specification

The specification proposes adding a `/llms.txt` markdown file to websites to provide LLM-friendly content. This file offers brief background information, guidance, and links to detailed markdown files.

### Key Properties

*   ✓**Human and LLM readable** — written in markdown for universal compatibility
*   ✓**Precise format** — allows fixed processing methods like parsers and regex
*   ✓**Located at root path** — accessible at `/llms.txt` (or optionally in a subpath)

The specification also proposes that pages with useful information for LLMs provide a clean markdown version at the same URL with `.md` appended.

## File Format & Structure

The llms.txt file uses Markdown to structure information. This makes it readable by both language models and humans while maintaining a specific format that can be processed programmatically.

### Required & Optional Sections

A file following the spec contains the following sections **in this specific order**:

REQUIRED H1 Header

The name of the project or site. This is the **only required section**.

OPTIONAL Blockquote Description

A short summary of the project containing key information necessary for understanding the rest of the file.

OPTIONAL Additional Details

Zero or more markdown sections (paragraphs, lists, etc.) of any type **except headings**, containing more detailed information.

OPTIONAL File Lists (H2 Sections)

Zero or more markdown sections delimited by H2 headers, containing "file lists" of URLs where further detail is available.

Each file list is a markdown list with: `[name](url)` followed optionally by `:` and notes.

**Special section: "Optional"** — If an H2 section named "Optional" is included, the URLs there can be skipped if a shorter context is needed. Use it for secondary information.

### Template Structure

## Example llms.txt File

Here's a real-world example based on the FastHTML project's llms.txt file:

### Use Cases

The versatility of llms.txt files means they can serve many purposes:

Software Documentation

Help developers find their way around APIs and libraries

Business Websites

Outline company structure, products, and services

E-commerce Sites

Explain products, categories, and policies

Educational Institutions

Provide quick access to course information and resources

Personal Websites

Help AI answer questions about your CV or portfolio

Legal/Government

Break down complex legislation for stakeholders

## Relationship to Existing Standards

llms.txt is designed to **coexist with current web standards**. While sitemaps list all pages for search engines, llms.txt offers a curated overview specifically for LLMs.

| File | Purpose | Used By |
| --- | --- | --- |
| robots.txt | Controls what pages get crawled; defines access permissions | Search engine bots |
| sitemap.xml | Lists all indexable pages on a site | Search engines |
| llms.txt | Provides curated, AI-readable content summary | AI systems (ChatGPT, Claude, etc.) |

### Why sitemap.xml isn't enough

*   ✗Often won't have LLM-readable versions of pages listed
*   ✗Doesn't include URLs to external sites (even helpful ones)
*   ✗Documents are too large in aggregate to fit in LLM context windows
*   ✗Includes unnecessary information not essential to understanding the site

**Key distinction:** robots.txt defines access permissions. llms.txt provides context for understanding. Our expectation is that llms.txt will mainly be useful for **inference** — when a user explicitly requests information about a topic.

## Best Practices

To create effective llms.txt files, follow these guidelines:

1

Use concise, clear language

Avoid jargon and keep descriptions brief but informative.

2

Include informative link descriptions

When linking to resources, explain what the AI will find there.

3

Avoid ambiguous terms

Don't use unexplained jargon or acronyms without context.

4

Test with multiple LLMs

Expand your llms.txt and test if various models can answer questions about your content.

## Tools & Integrations

Various tools and plugins are available to help integrate the llms.txt specification into your workflow:

llms_txt2ctx

CLI / Python

CLI and Python module for parsing llms.txt files and generating LLM context

vitepress-plugin-llms

VitePress

VitePress plugin that automatically generates LLM-friendly documentation

docusaurus-plugin-llms

Docusaurus

Docusaurus plugin for generating LLM-friendly documentation

Drupal LLM Support

Drupal 10.3+

A Drupal Recipe providing full support for the llms.txt proposal

llms-txt-php

PHP

A PHP library for writing and reading llms.txt Markdown files

VS Code PagePilot Extension

VS Code

VS Code Chat participant that automatically loads external context for enhanced responses

### Directories

Find websites with llms.txt files in these directories:

## Frequently Asked Questions

What is the llms.txt file format?
llms.txt is a markdown file placed at a website's root path (/llms.txt) that provides structured information for AI language models. It contains an H1 title, optional description blockquote, detailed information, and file lists with URLs to additional resources.

Who created the llms.txt specification?
The llms.txt specification was created by **Jeremy Howard** at Answer.AI and published on September 3, 2024. It was designed to help large language models better understand website content at inference time.

What sections are required in an llms.txt file?
Only one section is required: an **H1 heading** with the name of the project or site. All other sections (description blockquote, detailed information, and file lists) are optional but recommended.

How is llms.txt different from robots.txt?
robots.txt tells automated tools what access is acceptable (used by search indexing bots). llms.txt provides context and content for AI systems to understand your website at inference time when users request information.

Where should I place my llms.txt file?
The llms.txt file should be placed at the root of your website, accessible at `yoursite.com/llms.txt`. It can optionally be placed in a subpath if needed.

What is the "Optional" section for?
The "Optional" section (H2 header) has a special meaning — URLs listed there can be skipped if a shorter context is needed. Use it for secondary information that provides additional value but isn't essential.

How do I create an llms.txt file?
You can create one manually following the specification above, or use our [free llms.txt generator](https://llmstxtgenerator.org/) to automatically scan your website and generate a properly formatted file in seconds.

## Ready to create your llms.txt?

Generate a spec-compliant file automatically in 30 seconds.

[Generate llms.txt Free](https://llmstxtgenerator.org/)
No signup required
