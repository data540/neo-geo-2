---
title: "Search Analytics: query  |  Search Console API  |  Google for Developers"
url: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query"
publishedTime: "Mon, 14 Jul 2025 07:49:55 GMT"
---

**Requires [authorization](https://developers.google.com/webmaster-tools/v1/searchanalytics/query#auth)**

Query your search traffic data with filters and parameters that you define. The method returns zero or more rows grouped by the row keys (dimensions) that you define. You must define a date range of one or more days.

When date is one of the dimensions, any days without data are omitted from the result list. To learn which days have data, issue a query without filters grouped by date, for the date range of interest.

Results are sorted by click count descending. If two rows have the same click count, they are sorted in an arbitrary way.

See the [python sample](https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics) for calling this method.

The API is bounded by internal limitations of Search Console and does not guarantee to return all data rows but rather top ones.

[See limits to the amount of data available](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data#data_limits).

**JSON POST Example:**

POST https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwww.example.com%2F/searchAnalytics/query?key={MY_API_KEY}
{
  "startDate": "2015-04-01",
  "endDate": "2015-05-01",
  "dimensions": ["country","device"]
}

[Try it now](https://developers.google.com/webmaster-tools/v1/searchanalytics/query#try-it).

## Request

### HTTP request

POST https://www.googleapis.com/webmasters/v3/sites/siteUrl/searchAnalytics/query
### Parameters

| Parameter name | Value | Description |
| --- | --- | --- |
| **Path parameters** |
| `siteUrl` | `string` | The URL of the property as defined in Search Console. **Examples:**`http://www.example.com/` (for a URL-prefix property) or `sc-domain:example.com` (for a Domain property) |

### Authorization

This request requires authorization with at least one of the following scopes ([read more about authentication and authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)).

| Scope |
| --- |
| `https://www.googleapis.com/auth/webmasters.readonly` |
| `https://www.googleapis.com/auth/webmasters` |

### Request body

In the request body, supply data with the following structure:

{
 "startDate": string,
 "endDate": string,
 "dimensions": [
 string
 ],
 "type": string,
 "dimensionFilterGroups": [
 {
 "groupType": string,
 "filters": [
 {
 "dimension": string,
 "operator": string,
 "expression": string
 }
 ]
 }
 ],
 "aggregationType": string,
 "rowLimit": integer,
 "startRow": integer
}

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| `startDate` | `string` | [_Required_] Start date of the requested date range, in YYYY-MM-DD format, in PT time (UTC - 7:00/8:00). Must be less than or equal to the end date. This value is included in the range. |  |
| `endDate` | `string` | [_Required_] End date of the requested date range, in YYYY-MM-DD format, in PT time (UTC - 7:00/8:00). Must be greater than or equal to the start date. This value is included in the range. |  |
| `dimensions[]` | `list` | [_Optional_] Zero or more dimensions to group results by.Results are grouped in the order that you supply these dimensions.You can use any dimension name in [dimensionFilterGroups[].filters[].dimension](https://developers.google.com/webmaster-tools/v1/searchanalytics/query#dimensionFilterGroups.filters.dimension) as well as "date" and "hour".The grouping dimension values are combined to create a unique key for each result row. If no dimensions are specified, all values will be combined into a single row. There is no limit to the number of dimensions that you can group by, but you cannot group by the same dimension twice. **Example:**[country, device] |  |
| `searchType` | `string` | _Deprecated, use `type` instead_ |
| `type` | `string` | [_Optional_] Filter results to the following type: * "`discover`": Discover results * "`googleNews`": Results from news.google.com and the Google News app on Android and iOS. Doesn't include results from the "News" tab in Google Search. * "`news`": Search results from the "News" tab in Google Search. * "`image`": Search results from the "Image" tab in Google Search. * "`video`": Video search results * "`web`": [_Default_] Filter results to the combined ("All") tab in Google Search. Does not include Discover or Google News results. |  |
| `dimensionFilterGroups[]` | `list` | [_Optional_] Zero or more groups of filters to apply to the dimension grouping values. All filter groups must match in order for a row to be returned in the response. Within a single filter group, you can specify whether all filters must match, or at least one must match. |  |
| `dimensionFilterGroups[].groupType` | `string` | Whether all filters in this group must return true ("and"), or one or more must return true (_not yet supported)._ Acceptable values are: * "`and`": All filters in the group must return true for the filter group t o be true. |  |
| `dimensionFilterGroups[].filters[]` | `list` | [_Optional_] Zero or more filters to test against the row. Each filter consists of a dimension name, an operator, and a value. Max length 4096 characters. Examples: country equals FRA query contains mobile use device notContains tablet |  |
| `dimensionFilterGroups[].filters[].dimension` | `string` | The dimension that this filter applies to. You can filter by any dimension listed here, even if you are not grouping by that dimension. Acceptable values are: * "`country`": Filter against the specified country, as specified by 3-letter country code ([ISO 3166-1 alpha-3](http://en.wikipedia.org/wiki/ISO_3166-1_alpha-3)). * "`device`": Filter results against the specified device type. Supported values: * DESKTOP * MOBILE * TABLET * "`page`": Filter against the specified URI string. * "`query`": Filter against the specified query string. * "`searchAppearance`": Filter against a specific search result feature. To see a list of available values, run a query grouped by "searchAppearance". The full list of values and descriptions is also available in the [help documentation](https://support.google.com/webmasters/answer/7576553#by_search_appearance&zippy=%2Csearch-appearance). |  |
| `dimensionFilterGroups[].filters[].operator` | `string` | [_Optional_] How your specified value must match (or not match) the dimension value for the row. Acceptable values are: * "`contains`": The row value must either contain or equal your expression (non-case-sensitive). * "`equals`": [_Default_] Your expression must exactly equal the row value (case-sensitive for page and query dimensions). * "`notContains`": The row value must not contain your expression either as a substring or a (non-case-sensitive) complete match. * "`notEquals`": Your expression must not exactly equal the row value (case-sensitive for page and query dimensions). * "`includingRegex`": An [RE2 syntax](https://github.com/google/re2/wiki/Syntax) regular expression that must be matched. * "`excludingRegex`": An [RE2 syntax](https://github.com/google/re2/wiki/Syntax) regular expression that must not be matched. |  |
| `dimensionFilterGroups[].filters[].expression` | `string` | The value for the filter to match or exclude, depending on the operator. |  |
| `aggregationType` | `string` | [_Optional_] How data is aggregated. If aggregated by property, all data for the same property is aggregated; if aggregated by page, all data is aggregated by canonical URI. If you filter or group by page, choose auto; otherwise you can aggregate either by property or by page, depending on how you want your data calculated; see [the help documentation](https://support.google.com/webmasters/answer/6155685#urlorsite) to learn how data is calculated differently by site versus by page. **Note:** If you group or filter by page, you cannot aggregate by property. If you specify any value other than auto, the aggregation type in the result will match the requested type, or if you request an invalid type, you will get an error. The API will never change your aggregation type if the requested type is invalid. Acceptable values are: * "`auto`": [_Default_] Let the service decide the appropriate aggregation type. * "`byNewsShowcasePanel`": Aggregate values by [News Showcase panel](https://support.google.com/news/publisher-center/answer/10018888). This must be used in combination with the `NEWS_SHOWCASE``searchAppearance` filter and either `type=discover` or `type=googleNews`. If you group by page, filter by page, or filter to another `searchAppearance`, you can't aggregate by `byNewsShowcasePanel`. * "`byPage`": Aggregate values by URI. * "`byProperty`": Aggregate values by property. Not supported for `type=discover` or `type=googleNews` |  |
| `rowLimit` | `integer` | [_Optional; Valid range is 1–25,000; Default is 1,000_] The maximum number of rows to return. To page through results, use the `startRow` offset. |  |
| `startRow` | `integer` | [_Optional; Default is 0_] Zero-based index of the first row in the response. Must be a non-negative number. If `startRow` exceeds the number of results for the query, the response will be a successful response with zero rows. |  |
| `dataState` | `string` | [_Optional_] If "all" (case-insensitive), data will include [fresh data](https://developers.google.com/search/blog/2019/09/search-performance-fresh-data). If "final" (case-insensitive) or if this parameter is omitted, the returned data will include only finalized data. If "hourly_all" (case-insensitive), data will include hourly breakdown. This will indicate that hourly data includes partial data and should be used when grouping by the HOUR API dimension. |  |

## Response

Results are grouped according to the dimensions specified in the request. All values with the same set of dimension values will be grouped into a single row. For example, if you group by the country dimension, all results for "usa" will be grouped together, all results for "mdv" will be grouped together, and so on. If you grouped by country and device, then all results for "usa, tablet" will be grouped, all results for "usa, mobile" will be grouped, and so on. See the [Search Analytics report documentation](https://support.google.com/webmasters/answer/6155685) to learn the specifics of how clicks, impressions, and so on are calculated, and what they mean.

Results are sorted by click count, in descending order, unless you group by date, in which case results are sorted by date, in ascending order (oldest first, newest last). If there is a tie between two rows, the sort order is arbitrary.

See the rowLimit property in the request to learn the maximum number of values that can be returned.

{
 "rows": [
 {
 "keys": [
 string
 ],
 "clicks": double,
 "impressions": double,
 "ctr": double,
 "position": double
 }
 ],
 "responseAggregationType": string
}

| Property name | Value | Description | Notes |
| --- | --- | --- | --- |
| `rows[]` | `list` | A list of rows grouped by the key values in the order given in the query. |  |
| `rows[].keys[]` | `list` | A list of the dimension values for that row, grouped according to the dimensions in the request, in the order specified in the request. |  |
| `rows[].clicks` | `double` | Click count for the row. |  |
| `rows[].impressions` | `double` | Impression count for the row. |  |
| `rows[].ctr` | `double` | Click Through Rate (CTR) for the row. Values range from 0 to 1.0, inclusive. |  |
| `rows[].position` | `double` | Average position in search results. |  |
| `responseAggregationType` | `string` | How the results were aggregated.See[the help documentation](https://support.google.com/webmasters/answer/6155685#urlorsite)to learn how data is calculated differently by site versus by page. Acceptable values are: * "`auto`" * "`byPage`": Results were aggregated by page. * "`byProperty`": Results were aggregated by property. |  |
| `metadata` | `object` | An object that may be returned with your query results, providing context about the state of the data. When you request recent data (using `all` or `hourly_all` for [`dataState`](https://developers.google.com/webmaster-tools/v1/searchanalytics/query#dataState)), some of the rows returned may represent data that is incomplete, which means that the data is still being collected and processed. This metadata object helps you identify exactly when this starts and ends. All dates and times provided in this object are in the `America/Los_Angeles` time zone. The specific field returned within this object depends on how you've grouped your data in the request: * `first_incomplete_date` (`string`): The first date for which the data is still being collected and processed, presented in `YYYY-MM-DD` format (ISO-8601 extended local date format). This field is populated only when the request's `dataState` is `all` and data is grouped by `date`, and the requested date range contains incomplete data points. All values after the `first_incomplete_date` may still change noticeably. * `first_incomplete_hour` (`string`): The first hour for which the data is still being collected and processed, presented in `YYYY-MM-DDThh:mm:ss[+|-]hh:mm` format (ISO-8601 extended offset date-time format). This field is populated only when the request's `dataState` is `hourly_all`, and data is grouped by `hour` and the requested date range contains incomplete data points. All values after the `first_incomplete_hour` may still change noticeably. |  |
