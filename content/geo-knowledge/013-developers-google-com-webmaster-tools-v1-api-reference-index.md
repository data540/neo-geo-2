---
title: "API Reference  |  Search Console API  |  Google for Developers"
url: "https://developers.google.com/webmaster-tools/v1/api_reference_index"
publishedTime: "Tue, 23 Jul 2024 17:17:23 GMT"
---

[Skip to main content](https://developers.google.com/webmaster-tools/v1/api_reference_index#main-content)

*   [Home](https://developers.google.com/webmaster-tools)
*   [Guides](https://developers.google.com/webmaster-tools/about)
*   [Reference](https://developers.google.com/webmaster-tools/v1/api_reference_index)
*   [Open Search Console](https://search.google.com/search-console)

*   [List of methods](https://developers.google.com/webmaster-tools/v1/api_reference_index)
*   [Standard Error Messages](https://developers.google.com/webmaster-tools/v1/errors)

## API Reference Stay organized with collections  Save and categorize content based on your preferences.

*   On this page
*   [Search Analytics](https://developers.google.com/webmaster-tools/v1/api_reference_index#Search_analytics)
*   [Sitemaps](https://developers.google.com/webmaster-tools/v1/api_reference_index#Sitemaps)
*   [Sites](https://developers.google.com/webmaster-tools/v1/api_reference_index#Sites)
*   [URL Inspection](https://developers.google.com/webmaster-tools/v1/api_reference_index#Inspection_tools)

*   The Search Console API provides access to Search Analytics, Sitemaps, Sites, and URL Inspection services.

*   Search Analytics allows you to query traffic data for your website, filtered by parameters like date and dimensions such as country or device.

*   You can manage sitemaps through the API by listing, submitting, retrieving information about, or deleting them.

*   Manage websites in your Search Console account through the Sites service, allowing you to add, remove, list, and retrieve site information.

*   Inspect the Google index status of a specific webpage using the URL Inspection service, requiring the inspection URL, site URL, and language code.

The Search Console API offers the following services:

*   [**Search Analytics**](https://developers.google.com/webmaster-tools/v1/api_reference_index#Search_analytics) - Query traffic data for your site.
*   [**Sitemaps**](https://developers.google.com/webmaster-tools/v1/api_reference_index#Sitemaps) - List all your sitemaps, request information about a specific sitemap, and submit a sitemap to Google.
*   [**Sites**](https://developers.google.com/webmaster-tools/v1/api_reference_index#Sites) - List/add/remove properties from your Search Console account.
*   [**URL Inspection**](https://developers.google.com/webmaster-tools/v1/api_reference_index#Inspection_tools) - Inspect the status of a page in the Google index (equivalent to URL Inspection in Search Console).

## Search Analytics

For Search Analytics Resource details, see the [resource representation](https://developers.google.com/webmaster-tools/v1/searchanalytics#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/webmasters/v3, unless otherwise noted |
| [query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) | `POST /sites/siteUrl/searchAnalytics/query` | Query your search traffic data with filters and parameters that you define. The method returns zero or more rows grouped by the row keys (dimensions) that you define. You must define a date range of one or more days. When date is one of the dimensions, any days without data are omitted from the result list. To learn which days have data, issue a query without filters grouped by date, for the date range of interest. Results are sorted by click count descending. If two rows have the same click count, they are sorted in an arbitrary way. See the [python sample](https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics) for calling this method. **JSON POST Example:** POST https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwww.example.com%2F/searchAnalytics/query { "startDate": "2015-04-01", "endDate": "2015-05-01", "dimensions": ["country","device"] } |

## Sitemaps

For Sitemaps Resource details, see the [resource representation](https://developers.google.com/webmaster-tools/v1/sitemaps#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/webmasters/v3, unless otherwise noted |
| [delete](https://developers.google.com/webmaster-tools/v1/sitemaps/delete) | `DELETE /sites/siteUrl/sitemaps/feedpath` | Deletes a sitemap from this site. |
| [get](https://developers.google.com/webmaster-tools/v1/sitemaps/get) | `GET /sites/siteUrl/sitemaps/feedpath` | Retrieves information about a specific sitemap. |
| [list](https://developers.google.com/webmaster-tools/v1/sitemaps/list) | `GET /sites/siteUrl/sitemaps` | Lists the [sitemaps-entries](https://developers.google.com/webmaster-tools/v1/sitemaps) submitted for this site, or included in the sitemap index file (if `sitemapIndex` is specified in the request). |
| [submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit) | `PUT /sites/siteUrl/sitemaps/feedpath` | Submits a sitemap for a site. |

## Sites

For Sites Resource details, see the [resource representation](https://developers.google.com/webmaster-tools/v1/sites#resource) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URIs relative to https://www.googleapis.com/webmasters/v3, unless otherwise noted |
| [add](https://developers.google.com/webmaster-tools/v1/sites/add) | `PUT /sites/siteUrl` | Adds a site to the set of the user's sites in Search Console. |
| [delete](https://developers.google.com/webmaster-tools/v1/sites/delete) | `DELETE /sites/siteUrl` | Removes a site from the set of the user's Search Console sites. |
| [get](https://developers.google.com/webmaster-tools/v1/sites/get) | `GET /sites/siteUrl` | Retrieves information about specific site. |
| [list](https://developers.google.com/webmaster-tools/v1/sites/list) | `GET /sites` | Lists the user's Search Console sites. |

## URL Inspection

For URL Inspection resource details, see the [resource representation](https://developers.google.com/webmaster-tools/v1/urlInspection.index/urlInspection.index) page.

| Method | HTTP request | Description |
| --- | --- | --- |
| URI relative to https://searchconsole.googleapis.com/v1 |
| [index.inspect](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect) | `POST /urlInspection/index:inspect` | Information about the provided URL in the Google index. **JSON POST Example:** POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect { "inspectionUrl": "https://www.example.com/mypage", "siteUrl": "https://www.example.com/", "languageCode": "en-US"} |

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-07-23 UTC.
