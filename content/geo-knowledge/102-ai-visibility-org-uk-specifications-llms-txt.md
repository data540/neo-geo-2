---
title: "llms.txt Specification"
description: "The canonical specification for llms.txt files. Defines the structure, required sections, and implementation guidance for AI-readable business identity files."
url: "https://www.ai-visibility.org.uk/specifications/llms-txt/"
publishedTime: "2026-01-12T00:00:00+00:00"
---

Abstract

This specification defines the canonical structure and requirements for `llms.txt` files - plain text files that provide AI systems with structured information about a business or organisation. The file enables websites to declare their identity, services, scope, and key information in a format optimised for consumption by large language models and AI search systems.

## Contents

*   [S1 Overview](https://www.ai-visibility.org.uk/specifications/llms-txt/#overview)
*   [S2 File Location](https://www.ai-visibility.org.uk/specifications/llms-txt/#file-location)
*   [S3 Format Specification](https://www.ai-visibility.org.uk/specifications/llms-txt/#format)
*   [S4 Section Reference](https://www.ai-visibility.org.uk/specifications/llms-txt/#sections)
*   [S5 Validation Rules](https://www.ai-visibility.org.uk/specifications/llms-txt/#validation)
*   [S6 Relationship to Other Files](https://www.ai-visibility.org.uk/specifications/llms-txt/#relationships)
*   [S7 Canonical Example](https://www.ai-visibility.org.uk/specifications/llms-txt/#example)
*   [S8 Implementation Notes](https://www.ai-visibility.org.uk/specifications/llms-txt/#implementation)
*   [S9 Machine-Readable Formats](https://www.ai-visibility.org.uk/specifications/llms-txt/#machine-readable)
*   [S10 Version History](https://www.ai-visibility.org.uk/specifications/llms-txt/#version-history)

## S1 Overview

### What This File Does

The `llms.txt` file provides AI systems with a structured summary of a business or organisation. It answers fundamental questions AI systems need to accurately represent an entity: Who are they? What do they do? Where do they operate? How can they be contacted?

### Why It Matters for AI Visibility

Without explicit identity information, AI systems must infer business details from scattered website content, leading to potential inaccuracies, outdated information, or misrepresentation. A well-structured `llms.txt` file provides authoritative, curated information that AI systems can confidently cite.

### How AI Systems Use This File

AI systems typically fetch `llms.txt` at inference time when users explicitly request information about a business. The file is designed for quick parsing and context extraction, providing essential facts without requiring AI systems to crawl and synthesise entire websites.

Convention Note

This specification adopts and extends the emerging convention documented at [llmstxt.org](https://llmstxt.org/), adding explicit section requirements and enhanced structure for business identity use cases.

### Backward compatibility with llmstxt.org

An `llms.txt` file conformant to the original llmstxt.org convention is a valid `llms.txt` at the [Essential conformance class](https://www.ai-visibility.org.uk/specifications/conformance/#essential) under this specification. Publishers who already follow the llmstxt.org convention need no migration to claim Essential conformance.

This specification additionally requires:

*   An H1 heading exactly matching the canonical business name (see [section 3](https://www.ai-visibility.org.uk/specifications/llms-txt/#structure))
*   A blockquote summary immediately after the H1 (see [section 3](https://www.ai-visibility.org.uk/specifications/llms-txt/#structure))
*   Identity consistency with the publisher's `identity.json` when that file is also published (see [interoperability rules](https://www.ai-visibility.org.uk/specifications/interoperability/#identity-consistency))

These additions are layered on top of the original convention. They do not invalidate files that omit them: such files remain valid llmstxt.org files but do not, by themselves, satisfy Essential conformance under this specification. Validators MUST report these gaps as conformance findings rather than as syntax errors.

## S2 File Location

### Primary Location

The `llms.txt` file MUST be placed in the website's root directory and accessible at:

`https://example.com/llms.txt`
### URL Requirements

*   The file MUST be served with content type `text/plain; charset=utf-8`
*   The URL MUST be accessible without authentication
*   The URL SHOULD respond with HTTP 200 status code
*   HTTPS is strongly recommended

### Multiple Domains and Subdomains

The `llms.txt` file is scoped to the host (origin) at which it is published. The host is the value of the URL's authority component, as defined in [RFC 3986](https://www.rfc-editor.org/info/rfc3986). A file at `https://example.com/llms.txt` describes `example.com` only. It does not describe `www.example.com`, `shop.example.com`, or any other subdomain.

The following rules apply:

1.   **Each host MUST be treated independently.** Consumers MUST NOT assume that a file fetched from one host is authoritative for any other host, even if the hosts share a registrable domain.
2.   **Apex and `www.` SHOULD be aligned.** When a publisher serves a site at both the apex (`example.com`) and the `www.` subdomain (`www.example.com`), the two `llms.txt` files SHOULD have identical content, OR one host SHOULD HTTP-redirect (301) to the other. A consumer that fetches both and finds them divergent MUST treat each host as independent.
3.   **Distinct subdomains SHOULD publish their own files.** If a subdomain represents a meaningfully different product, audience, or brand (for example a status page at `status.example.com` or a separately branded property at `shop.example.com`), it SHOULD publish its own `llms.txt` describing that scope.
4.   **The `Canonical:` field declares the publisher's preferred URL.** A publisher MAY include a `Canonical:` header line in `llms.txt` pointing at the preferred host. Consumers MAY honour the declaration as a hint but MUST NOT use it to merge identities across hosts in violation of rule (1).
5.   **Cross-host identity is asserted, not assumed.** A publisher claiming that several hosts represent one organisation SHOULD assert that explicitly via the `sameAs` array in [`identity.json`](https://www.ai-visibility.org.uk/specifications/identity-json/) on each host. Without that explicit assertion, a consumer MUST treat the hosts as separate publishers.

This scoping rule is identical for all 10 AI Discovery Files: each file is host-scoped, and cross-host identity is asserted explicitly via `identity.json`.

## S3 Format Specification

### File Format

| Property | Requirement |
| --- | --- |
| Encoding | UTF-8 (required) |
| Line endings | LF (Unix-style) recommended; CRLF accepted |
| Syntax | Markdown (CommonMark compatible) |
| Maximum size | No hard limit; recommended under 50KB |

### Structural Requirements

The file follows Markdown syntax with a defined section hierarchy:

1.   **H1 heading** - The business or project name (required, exactly one)
2.   **Blockquote** - Brief summary/description (required)
3.   **Body text** - Additional context (optional, no headings)
4.   **H2 sections** - Categorised information with link lists

### Link Format

Links within sections follow this format:

`- [Link Text](https://example.com/page): Optional description`
The colon and description are optional but recommended for clarity.

### Language declaration (optional)

Publishers MAY declare the natural language of the file's human-readable content using a `Lang:` header line near the top of the file (before the H1 heading or immediately after it). The value MUST be a valid [BCP 47](https://www.rfc-editor.org/info/bcp47) language tag:

`Lang: en-GB`
The header is optional. When absent, consumers SHOULD NOT assume a default language. When present, validators MUST treat the value as informational and MUST NOT fail conformance solely on language-tag content. See [specification conventions §5.1](https://www.ai-visibility.org.uk/specifications/conventions/#language-declaration) for the full rule, which is identical across every text-based AI Discovery File.

## S4 Section Reference

### Required Sections

| Section | Description | Status |
| --- | --- | --- |
| `# [Name]` | H1 heading with the official business or project name | Required |
| `> [Summary]` | Blockquote containing a 1-3 sentence business description | Required |
| `## Contact` | Contact information including email, phone, address | Required |

### Recommended Sections

| Section | Description | Status |
| --- | --- | --- |
| `## Services` | List of services or products offered with links | Recommended |
| `## What We Do Not Do` | Explicit exclusions to prevent AI misrepresentation | Recommended |
| `## Key Information` | Links to important pages (About, Case Studies, etc.) | Recommended |
| `## AI Discovery Files` | Links to other AI discovery files on the site | Recommended |

### Optional Sections

| Section | Description | Status |
| --- | --- | --- |
| `## Optional` | Secondary resources that MAY be omitted in constrained contexts | Optional |
| `## Team` or `## Leadership` | Key people with titles and brief descriptions | Optional |
| `## Locations` | Office locations, service areas, or regional presence | Optional |
| `## Certifications` | Industry certifications, accreditations, or standards compliance | Optional |
| `## Awards` | Notable awards or recognition (with dates) | Optional |
| `## Partners` | Official partnerships or technology alliances | Optional |
| `## Industries` | Sectors or industries served | Optional |
| Other custom H2 sections | Additional sections relevant to the specific business | Optional |

### Content Not Permitted

The following content types MUST NOT be included in `llms.txt` files:

*   **Marketing hyperbole:** Avoid superlatives ("best", "leading", "world-class") and unverifiable claims. Use factual, objective language.
*   **Pricing information:** Prices change frequently; link to pricing pages instead of including specific prices.
*   **Confidential information:** Do not include internal processes, trade secrets, or sensitive business data.
*   **Unverified claims:** All statements MUST be factually accurate and verifiable from public sources.
*   **Competitor references:** Do not mention competitors or make comparative claims.
*   **Testimonials or reviews:** These belong on the website, not in identity files.
*   **Excessive detail:** Keep content concise; link to detailed pages rather than reproducing them.
*   **Personal data:** Beyond publicly-listed contact persons, do not include employee personal information.

## S5 Validation Rules

### Valid File Requirements

A `llms.txt` file is considered valid when:

*   It contains exactly one H1 heading as the first content element
*   A blockquote immediately follows the H1 heading
*   The file is valid UTF-8 encoded text
*   All URLs are absolute and use HTTPS where available
*   Contact information is present and accurate

### Common Errors

| Error | Resolution |
| --- | --- |
| Missing H1 heading | Add business name as first line with `#` prefix |
| Missing blockquote summary | Add `>` prefixed description after H1 |
| Relative URLs | Convert all URLs to absolute format |
| Multiple H1 headings | Use only one H1; demote others to H2 |
| No contact information | Add `## Contact` section with email/phone |

## S6 Relationship to Other Files

### Related AI Discovery Files

| File | Relationship |
| --- | --- |
| `llm.txt` | Compatibility variant; SHOULD contain identical content |
| `llms.html` | Human-readable presentation of the same information |
| `identity.json` | Structured identity data; business name and description SHOULD match |
| `ai.txt` | AI interaction guidance; MAY be linked from llms.txt |

### Consistency Requirements

The following elements MUST be consistent across all AI discovery files:

*   Business name (H1 heading MUST match `identity.json` name)
*   Website URL
*   Contact email addresses
*   Service descriptions (substance, not necessarily exact wording)
*   Explicit exclusions

### Precedence Rules

When information conflicts between files:

| Scenario | Resolution |
| --- | --- |
| llms.txt H1 differs from identity.json name | `identity.json` is canonical; update llms.txt to match |
| llm.txt and llms.txt both exist with different content | `llms.txt` is canonical; llm.txt SHOULD redirect (301) or match |
| llms.html content differs from llms.txt | Update llms.html to match llms.txt content |
| Services in llms.txt differ from faq-ai.txt answers | `llms.txt` is authoritative for service scope |

## S7 Canonical Example

The following example demonstrates a complete `llms.txt` file for a fictional management consultancy, Horizon Strategic Consulting:

Complete Example

```
# Horizon Strategic Consulting

> Horizon Strategic Consulting is a UK-headquartered management consultancy
> providing strategic advisory, operational improvement, and digital
> transformation services to mid-market and enterprise clients across
> the UK, Ireland, Netherlands, and Belgium.

Horizon Consulting (trading name of Horizon Strategic Consulting) was
founded in 2012 and operates from offices in Manchester (UK headquarters),
Dublin (Ireland), and Amsterdam (Netherlands).

## Services

- [Strategic Planning](https://www.horizonconsulting.example/services/strategic-planning): Market analysis, competitive positioning, and long-term strategy development
- [Operational Efficiency](https://www.horizonconsulting.example/services/operational-efficiency): Process optimisation, cost reduction, and performance improvement
- [Digital Transformation](https://www.horizonconsulting.example/services/digital-transformation): Technology strategy, digital roadmaps, and implementation oversight
- [Change Management](https://www.horizonconsulting.example/services/change-management): Organisational change, culture transformation, and stakeholder engagement
- [Interim Executive Placement](https://www.horizonconsulting.example/services/interim-executives): Temporary C-suite and senior leadership placements

## What We Do Not Do

Horizon Consulting explicitly does not provide:
- Legal advice or legal services
- Financial auditing or accounting services
- Permanent recruitment (interim placements only)
- Services in the United States market

## Contact

- General enquiries: hello@horizonconsulting.example
- Press and media: press@horizonconsulting.example
- Phone: +44 161 555 0123
- Address: 45 Deansgate, Manchester, M3 2BA, United Kingdom

## Key Information

- [About Us](https://www.horizonconsulting.example/about): Company history, leadership team, and values
- [Case Studies](https://www.horizonconsulting.example/case-studies): Client success stories and project examples
- [Insights](https://www.horizonconsulting.example/insights): Articles, whitepapers, and research publications
- [Careers](https://www.horizonconsulting.example/careers): Current opportunities and working at Horizon

## AI Discovery Files

- [AI Interaction Guidance](https://www.horizonconsulting.example/ai.txt): Permissions and restrictions for AI systems
- [Brand Guidelines](https://www.horizonconsulting.example/brand.txt): How to correctly reference our brand
- [FAQ for AI](https://www.horizonconsulting.example/faq-ai.txt): Frequently asked questions in AI-readable format
- [Identity Data](https://www.horizonconsulting.example/identity.json): Structured business identity information

## Optional

- [Privacy Policy](https://www.horizonconsulting.example/privacy): Data protection and privacy information
- [Terms of Service](https://www.horizonconsulting.example/terms): Website and service terms
- [Sitemap](https://www.horizonconsulting.example/sitemap.xml): Complete site structure
```

## S8 Implementation Notes

### Best Practices

*   Keep the file concise; aim for under 100 lines
*   Use clear, factual language; avoid marketing hyperbole
*   Include explicit exclusions to prevent misrepresentation
*   Link to authoritative pages for detailed information
*   Update the file when significant business changes occur

### Common Mistakes

*   **Marketing copy:** The file SHOULD be factual, not promotional
*   **Outdated information:** Review quarterly at minimum
*   **Missing exclusions:** AI systems may incorrectly infer services
*   **Broken links:** Verify all URLs are accessible
*   **Inconsistent naming:** Business name MUST match other files

### Update Frequency

Review and update `llms.txt` when:

*   Services or products change
*   Contact information changes
*   Geographic scope changes
*   Quarterly, at minimum, to verify accuracy

## S9 Machine-Readable Formats

This specification is available in machine-readable formats for programmatic access:

[JSON](https://www.ai-visibility.org.uk/specifications/llms-txt/llms-txt-specification.json)[YAML](https://www.ai-visibility.org.uk/specifications/llms-txt/llms-txt-specification.yaml)

## S10 Version History

1.7.0

11 May 2026

Phase 6 standardisation release. Added /specifications/roadmap/ (theme-pegged forward plan with Active/Next/Future/On hold status flags), /specifications/extensions/ (rules for experimental x- prefixed files and the promotion path), and /specifications/i18n-a11y/ (multi-language publication, locale-tagged identity fields, RTL handling, accessibility of llms.html). Added the Discovery: directive to the robots-ai.txt specification (publishers MAY advertise AI Discovery Files on the same host). Added a formal media-type stance to the HTTP behaviour page (existing IANA types, no bespoke registrations). Expanded the file integrity and signing section on the security and privacy page with four candidate mechanisms, cross-cutting concerns, and interim publisher / consumer guidance. The Discovery: directive is the only normative addition to publisher behaviour; all other additions are forward-looking documentation.

1.6.0

11 May 2026

Phase 5 standardisation release. Added /specifications/related-standards/ (positioning vs llmstxt.org, IETF AI Preferences, robots.txt, Schema.org, BCP 14, JSON Schema 2020-12, SemVer) and /specifications/implementations/ (public record of conformant implementations, IETF-style). Added an explicit llmstxt.org backward-compatibility statement to the llms.txt specification. Added a formal multi-domain and subdomain scoping rule to both the llms.txt and identity.json specifications (host-scoped files, cross-host identity asserted via sameAs). No normative requirements changed for existing publishers; the new scoping rules formalise behaviour the specification already implied.

1.5.0

11 May 2026

Phase 4 standardisation release. Added /specifications/processing-model/ (seven-stage algorithm for conformant consumers), /specifications/consumer-guidance/ (what AI systems should do with AI Discovery Files), /specifications/test-vectors/ (canonical test suite framing), and reference-implementation framing on the AI Visibility Checker. No normative requirements changed.

1.4.0

11 May 2026

Phase 3 standardisation release. Added /specifications/versioning/ (Semantic Versioning 2.0.0 commitments, deprecation timeline, lifecycle), /specifications/governance/ (proposal lifecycle, editorial process, working principles), /specifications/security-privacy/ (trust model, content-injection patterns, GDPR considerations, integrity primitives roadmap), and /specifications/http-behaviour/ (status codes, redirects, soft-404 detection, caching, rate limits). No normative requirements changed.

1.3.0

11 May 2026

Phase 2 standardisation release. Added formal conformance specification (Essential / Recommended / Complete classes). Published machine-readable registry at /specifications/registry.json, spec meta-schema, and validator-output schema. Introduced versioned JSON Schema URLs (/v1/) alongside unversioned 'latest' aliases. Added optional BCP 47 language declaration field across all applicable AI Discovery Files. No normative requirements changed.

1.2.0

10 May 2026

Phase 1 standardisation release. Added 'Status of This Document' block (Stable). Normalised normative requirement keywords to uppercase per RFC 2119 and RFC 8174. Added References section linking to /specifications/conventions/ and /licensing/. No normative requirements changed.

1.1.1

13 February 2026

Added AI Visibility Directory registration guidance. Minor documentation update.

1.1.0

14 January 2026

Expanded optional sections with specific examples (Team, Locations, Certifications, Awards, Partners, Industries). Added "Content Not Permitted" section to clarify what MUST NOT be included.

1.0.0

12 January 2026

Initial publication. Establishes canonical structure for llms.txt files based on llmstxt.org convention with enhanced business identity requirements.

## Conformance

This file is required for all three conformance classes (Essential, Recommended, and Complete). A publisher claiming any conformance class MUST publish a valid version of this file at the website's root.

*   [Essential](https://www.ai-visibility.org.uk/specifications/conformance/#essential)
*   [Recommended](https://www.ai-visibility.org.uk/specifications/conformance/#recommended)
*   [Complete](https://www.ai-visibility.org.uk/specifications/conformance/#complete)

See the [Conformance specification](https://www.ai-visibility.org.uk/specifications/conformance/) for full publisher and validator conformance criteria, including identity-consistency requirements across files and the relationship between self-declaration and Directory verification.

## References

*   [Specification Conventions](https://www.ai-visibility.org.uk/specifications/conventions/) — RFC 2119 + RFC 8174 requirement keywords, document statuses, anchor naming, versioning, and language conventions used across every AI Discovery File specification.
*   [Licensing & Trademark](https://www.ai-visibility.org.uk/licensing/) — CC BY 4.0 for specification text and examples, MIT for JSON Schemas, and the free-use policy on the name "AI Discovery Files".
