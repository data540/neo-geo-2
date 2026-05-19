---
title: "Columnar index"
description: "Learn how to use the Common Crawl CDXJ index to query web captures, understand the CDXJ format, and retrieve WARC records via the API."
url: "https://commoncrawl.org/cdxj-index"
publishedTime: "Fri, 15 May 2026 12:59:57 GMT"
---

The Common Crawl Foundation provides two indexes for querying the Common Crawl corpus: the CDXJ index and the columnar index. This page introduces the CDXJ index and gives some examples of how to use it.

**Note:** In other documentation, this index is often referred to as the CDX index for legacy reasons.

## What is the CDXJ Index?

The CDXJ index is one of the indices available for querying the Common Crawl corpus. It is an index to the WARC files and URLs in the Common Crawl corpus in the [CDXJ file format](https://specs.webrecorder.net/cdxj/0.1.0/). This format of the index is optimised for querying individual page captures in the crawl.

The index is served from [index.commoncrawl.org](https://index.commoncrawl.org/), or alternatively the index files are available on the Commmon Crawl bucket on AWS S3 below the prefix `s3://commoncrawl/cc-index/collections/`. Some of the ways to query the index are through the [API Web Interface](https://index.commoncrawl.org/), using command-line tools like `curl` or via libraries like [cdx_toolkit](https://github.com/commoncrawl/cdx_toolkit). That said, you can use any tool you like: the CDXJ index is free to access or download for anybody.

The page explains the CDXJ format and provides examples of querying it to select individual page captures. Further examples are available on our [Get Started](https://commoncrawl.org/get-started) page or as part of the [Whirlwind Tour](https://github.com/commoncrawl/whirlwind-python).

## Using the CDXJ Index

The CDXJ index files are sorted, plain-text files where each line contains information about a single capture in Common Crawl's corpus. They are `gzip`-compressed in blocks of 3000 lines in a way that allows random access to the files. Each month, new index files are published along with the other crawl data. This means that there is no index covering all monthly crawls. However, Common Crawl lists all monthly indices at [https://index.commoncrawl.org/collinfo.json](https://index.commoncrawl.org/collinfo.json).

## API Web Interface and CDXJ Format

The web interface can be found by visiting [index.commoncrawl.org](https://index.commoncrawl.org/). To query the index for a particular crawl, select the crawl of interest from the dropdown and type your query in the box below.

As an example, we can select the crawl `CC-MAIN-2025-43` and query for `commoncrawl.org/get-started`. This should bring back two records:

```
{"urlkey": "org,commoncrawl)/get-started", "timestamp": "20251014220259", "url": "https://www.commoncrawl.org/get-started", "mime": "text/html", "mime-detected": "text/html", "status": "200", "digest": "D4IRZZ6NS7QW37BB2ODQPCUGG7ISRFGV", "length": "12675", "offset": "686242195", "filename": "crawl-data/CC-MAIN-2025-43/segments/1759648359293.23/warc/CC-MAIN-20251014214924-20251015004924-00758.warc.gz", "languages": "eng", "encoding": "UTF-8"}
{"urlkey": "org,commoncrawl)/get-started", "timestamp": "20251016192109", "url": "https://commoncrawl.org/get-started", "mime": "text/html", "mime-detected": "text/html", "status": "200", "digest": "ZWUFCT57EAYE6Z2QRZ3UF4PQA5TG3BEP", "length": "12695", "offset": "160581106", "filename": "crawl-data/CC-MAIN-2025-43/segments/1759648664410.92/warc/CC-MAIN-20251016175923-20251016205923-00549.warc.gz", "languages": "eng", "encoding": "UTF-8"}
```

Each line of the index consists of a JSON object containing the following name attributes:

*   `urlkey`: the URL in [SURT](http://crawler.archive.org/articles/user_manual/glossary.html#surt) format (to optimise indexing).
*   `timestamp`: time of capture.
*   `url`: URL of the captured page.
*   `mime`: the [MIME type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types) indicating the nature and format of the capture, as sent in the HTTP response header.
*   `mime-detected`: MIME type detected based on content.
*   `status`: the [HTTP status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) returned when fetching the page.
*   `digest`: `SHA-1` checksum of the contents of the capture.
*   `length`: length of the WARC record.
*   `offset`: file offset of the start of the WARC record in its crawl segment.
*   `filename`: filename of the crawl segment containing the record.
*   `languages`: language(s) contained in the record, as predicted by CLD2.
*   `encoding`: character encoding of the fetched page.

## API Web Interface and CDXJ Format

The information contained in the index allows us to retrieve records from the Common Crawl corpus. Specifically, we need the `filename`, `offset` and `length` fields. Following from the example above, we'll retrieve the capture from the second record by sending an HTTP range request to the Common Crawl bucket:

```
OFFSET=160581106
LENGTH=12695
FILENAME="crawl-data/CC-MAIN-2025-43/segments/1759648664410.92/warc/CC-MAIN-20251016175923-20251016205923-00549.warc.gz"
curl -s -r$OFFSET-$(($OFFSET+$LENGTH-1)) "https://data.commoncrawl.org/$FILENAME" > get-started.warc.gz
```

Decompressing the returned record allows us to view the WARC:

`gzip -dc get-started.warc.gz | head -n20`
```
WARC/1.0
WARC-Type: response
WARC-Date: 2025-10-16T19:21:09Z
WARC-Record-ID: <urn:uuid:a7d2560a-da6b-46ae-8db8-2632a5a661c6>
Content-Length: 66093
Content-Type: application/http; msgtype=response
WARC-Warcinfo-ID: <urn:uuid:aa18de6a-0138-4061-ab49-17e627e65737>
WARC-Concurrent-To: <urn:uuid:fa07e6a4-defb-42a6-8705-c28917328854>
WARC-IP-Address: 18.211.166.153
WARC-Target-URI: https://commoncrawl.org/get-started
WARC-Protocol: h2
WARC-Protocol: tls/1.3
WARC-Cipher-Suite: TLS_AES_256_GCM_SHA384
WARC-Payload-Digest: sha1:ZWUFCT57EAYE6Z2QRZ3UF4PQA5TG3BEP
WARC-Block-Digest: sha1:ILRDEM32Q3UCWOSNH2B7A5TALEM5UBYA
WARC-Identified-Payload-Type: text/html

HTTP/1.1 200 
date: Thu, 16 Oct 2025 19:21:09 GMT
content-type: text/html
```

## Query with cdx-toolkit

[cdx-toolkit](https://github.com/commoncrawl/cdx_toolkit) facilitates working with CDX indices of web crawls and archives. Documentation for how to use it is available in its GitHub repository. To install it, you can use pip:

`pip install cdx_toolkit`
We can use the cdx-toolkit to query the index for `CC-MAIN-2025-43` for `commoncrawl.org/get-started` as follows:

`cdxt --crawl CC-MAIN-2025-43 iter 'commoncrawl.org/get-started'`
This returns the same two records as above:

```
status 200, timestamp 20251014220259, url https://www.commoncrawl.org/get-started
status 200, timestamp 20251016192109, url https://commoncrawl.org/get-started
```

To bring that the same WARC record as last time, run the following:

`cdxt --crawl CC-MAIN-2025-43 --from 20251016192109 --limit 1 warc 'commoncrawl.org/get-started'`
Decompressing the returned WARC file shows it matches the one before.

## Resources

*   URL of the CDXJ index: [https://index.commoncrawl.org](https://index.commoncrawl.org/).
*   Prefix for the CDXJ index files on S3: `s3://commoncrawl/cc-index/collections/`.
*   A full list of all CDX(J) index files available for the Common Crawl corpus is found at [https://data.commoncrawl.org/cc-index/collections/index.html](https://data.commoncrawl.org/cc-index/collections/index.html).
*   The [CDX Server API Documentation](https://github.com/webrecorder/pywb/wiki/CDX-Server-API) is a reference for the API for querying the index.
*   The [Whirlwind Tour](https://github.com/commoncrawl/whirlwind-python) gives further examples of querying the CDXJ index using Python.

## Acknowledgements

Thanks to Ilya Kreymer for his work on the CDX(J) index.
