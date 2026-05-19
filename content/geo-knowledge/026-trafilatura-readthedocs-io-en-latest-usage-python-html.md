---
title: "With Python — Trafilatura 2.0.0 documentation"
description: "This tutorial focuses on text extraction from web pages with Python code snippets. Data mining with this library encompasses HTML parsing and language identification."
url: "https://trafilatura.readthedocs.io/en/latest/usage-python.html"
publishedTime: "Sat, 15 Mar 2025 10:50:22 GMT"
---

## The Python programming language[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#the-python-programming-language "Link to this heading")

Python can be easy to pick up whether you’re a first time programmer or you’re experienced with other languages:

*   Official [Python Tutorial](https://docs.python.org/3/tutorial/)

*   [The Hitchhiker’s Guide to Python](https://docs.python-guide.org/)

*   [The Best Python Tutorials (freeCodeCamp)](https://www.freecodecamp.org/news/best-python-tutorial/)

## Step-by-step[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#step-by-step "Link to this heading")

### Quickstart[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#quickstart "Link to this heading")

For the basics see [quickstart documentation page](https://trafilatura.readthedocs.io/en/latest/quickstart.html).

### Output[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#output "Link to this heading")

By default, the output is in plain text (TXT) format without metadata. The following additional formats are available:

*   CSV

*   HTML (from version 1.11 onwards)

*   JSON

*   Markdown (from version 1.9 onwards)

*   XML and XML-TEI (following the guidelines of the Text Encoding Initiative)

To specify the output format, use one of the following strings: `"csv", "json", "html", "markdown", "txt", "xml", "xmltei"`.

The `bare_extraction` function also accepts an additional `python` format to work with Python on the output.

To extract and include metadata in the output, use the `with_metadata=True` argument.

#### Examples[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#examples "Link to this heading")

# some formatting preserved in basic XML structure
>>> extract(downloaded, output_format="xml")

# output in JSON format with metadata extracted
>>> extract(downloaded, output_format="json", with_metadata=True)

Note that combining TXT, CSV and JSON formats with certain structural elements (e.g. formatting or links) triggers output in Markdown format (plain text with additional elements).

### Choice of HTML elements[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#choice-of-html-elements "Link to this heading")

Customize the extraction process by including or excluding specific HTML elements:

*   Text elements:`include_comments=True`
Include comment sections at the bottom of articles.

`include_tables=True`
Extract text from HTML `<table>` elements.

*   Structural elements:`include_formatting=True`
Keep structural elements related to formatting (`<b>`/`<strong>`, `<i>`/`<emph>` etc.)

`include_links=True`
Keep link targets (in `href="..."`)

`include_images=True`
Keep track of images along with their targets (`<img>` attributes: alt, src, title)

To operate on these elements, pass the corresponding parameters to the `extract()` function:

# exclude comments from the output
>>> result = extract(downloaded, include_comments=False)

# skip tables and include links in the output
>>> result = extract(downloaded, include_tables=False, include_links=True)

# convert relative links to absolute links where possible
>>> extract(downloaded, output_format='xml', include_links=True, url=url)

#### Important notes[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#important-notes "Link to this heading")

*   `include_comments` and `include_tables` are activated by default.

*   Including extra elements works best with conversion to XML formats or using `bare_extraction()`. This allows for direct display and manipulation of the elements.

*   Certain elements may not be visible in the output if the chosen format does not allow it.

*   Selecting Markdown automatically includes text formatting.

Hint

The heuristics used by the main algorithm change according to the presence of certain elements in the HTML. If the output seems odd, try removing a constraint (e.g. formatting) to improve the result.

### The precision and recall presets[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#the-precision-and-recall-presets "Link to this heading")

The main extraction functions offer two presets to adjust to focus of the extraction process: `favor_precision` and `favor_recall`.

These parameters allow you to change the balance between accuracy and comprehensiveness of the output.

>>> result = extract(downloaded, url, favor_precision=True)

#### Precision[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#precision "Link to this heading")

*   If your results contain too much noise, prioritize precision to focus on the most central and relevant elements.

*   Additionally, you can use the `prune_xpath` parameter to target specific HTML elements using a list of XPath expressions.

#### Recall[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#recall "Link to this heading")

*   If parts of your documents are missing, try this preset to take more elements into account.

*   If content is still missing, refer to the [troubleshooting guide](https://trafilatura.readthedocs.io/en/latest/troubleshooting.html).

### Guessing if text can be found[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#guessing-if-text-can-be-found "Link to this heading")

The function `is_probably_readerable()` has been ported from Mozilla’s Readability.js, it is available from version 1.10 onwards and provides a way to guess if a page probably has a main text to extract.

>>> from trafilatura.readability_lxml import is_probably_readerable
>>> is_probably_readerable(html)  # HTML string or already parsed tree

### Language identification[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#language-identification "Link to this heading")

The target language can also be set using 2-letter codes (ISO 639-1), there will be no output if the detected language of the result does not match and no such filtering if the identification component has not been installed (see above [installation instructions](https://trafilatura.readthedocs.io/en/latest/installation.html)) or if the target language is not available.

>>> result = extract(downloaded, url, target_language="de")

Note

Additional components are required: `pip install trafilatura[all]`. This feature currently uses the [py3langid package](https://github.com/adbar/py3langid) and is dependent on language availability and performance of the original model.

### Optimizing for speed[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#optimizing-for-speed "Link to this heading")

Execution speed not only depends on the platform and on supplementary packages (`trafilatura[all]`, `htmldate[speed]`), but also on the extraction strategy.

The available fallbacks make extraction more precise but also slower. The use of fallback algorithms can also be bypassed in _fast_ mode, which should make extraction about twice as fast:

# skip algorithms used as fallback
>>> result = extract(downloaded, no_fallback=True)

The following combination usually leads to shorter processing times:

>>> result = extract(downloaded, include_comments=False, include_tables=False, no_fallback=True)

## Input/Output types[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#input-output-types "Link to this heading")

### Python objects as output[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#python-objects-as-output "Link to this heading")

The extraction can be customized using a series of parameters, for more see the [core functions](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) page.

The function `bare_extraction` can be used to bypass output conversion, it returns Python variables for metadata (dictionary) as well as main text and comments (both LXML objects).

>>> from trafilatura import bare_extraction
>>> bare_extraction(downloaded)

### Raw HTTP response objects[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#raw-http-response-objects "Link to this heading")

The `fetch_response()` function can pass a response object straight to the extraction.

This can be useful to get the final redirection URL with `response.url` and then pass is directly as a URL argument to the extraction function:

# necessary components
>>> from trafilatura import fetch_response, bare_extraction

# load an example
>>> response = fetch_response("https://www.example.org")

# perform extract() or bare_extraction() on Trafilatura's response object
>>> bare_extraction(response.data, url=response.url)  # here is the redirection URL

### LXML objects[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#lxml-objects "Link to this heading")

The input can consist of a previously parsed tree (i.e. a _lxml.html_ object), which is then handled seamlessly:

# define document and load it with LXML
>>> from lxml import html
>>> my_doc = """<html><body><article><p>
 Here is the main text.
 </p></article></body></html>"""
>>> mytree = html.fromstring(my_doc)

# extract from the already loaded LXML tree
>>> extract(mytree)
'Here is the main text.'

### Interaction with BeautifulSoup[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#interaction-with-beautifulsoup "Link to this heading")

Here is how to convert a BS4 object to LXML format in order to use it with Trafilatura:

>>> from bs4 import BeautifulSoup
>>> from lxml.html.soupparser import convert_tree
>>> from trafilatura import extract

>>> soup = BeautifulSoup("<html><body><time>The date is Feb 2, 2024</time></body></html>", "lxml")
>>> lxml_tree = convert_tree(soup)[0]
>>> extract(lxml_tree)

## Navigation[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#navigation "Link to this heading")

Three potential navigation strategies are currently available: feeds (mostly for fresh content), sitemaps (for exhaustivity, all potential pages as listed by the owners) and discovery by web crawling (i.e. by following the internal links, more experimental).

### Feeds[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#feeds "Link to this heading")

The function `find_feed_urls` is a all-in-one utility that attempts to discover the feeds from a webpage if required and/or downloads and parses feeds. It returns the extracted links as list, more precisely as a sorted list of unique links.

# import the feeds module
>>> from trafilatura import feeds

# use the homepage to automatically retrieve feeds
>>> mylist = feeds.find_feed_urls('https://www.theguardian.com/')
>>> mylist
['https://www.theguardian.com/international/rss', '...'] # and so on

# use a predetermined feed URL directly
>>> mylist = feeds.find_feed_urls('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml')
>>> mylist is not []
True # it's not empty

Note

The links are seamlessly filtered for patterns given by the user, e.g. using `https://www.un.org/en/` as argument implies taking all URLs corresponding to this category.

An optional argument `target_lang` makes it possible to filter links according to their expected target language. A series of heuristics are applied on the link path and parameters to try to discard unwanted URLs, thus saving processing time and download bandwidth.

# the feeds module has to be imported
# search for feeds in English
>>> mylist = feeds.find_feed_urls('https://www.un.org/en/rss.xml', target_lang='en')
>>> mylist is not []
True # links found as expected

# target_lang set to Japanese, the English links are discarded
>>> mylist = feeds.find_feed_urls('https://www.un.org/en/rss.xml', target_lang='ja')
>>> mylist
[]

For more information about feeds and web crawling see:

*   This blog post: [Using RSS and Atom feeds to collect web pages with Python](https://adrien.barbaresi.eu/blog/using-feeds-text-extraction-python.html)

*   This Youtube tutorial: [Extracting links from ATOM and RSS feeds](https://www.youtube.com/watch?v=NW2ISdOx08M&list=PL-pKWbySIRGMgxXQOtGIz1-nbfYLvqrci&index=2&t=136s)

### Sitemaps[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#sitemaps "Link to this heading")

*   Youtube tutorial: [Learn how to process XML sitemaps to extract all texts present on a website](https://www.youtube.com/watch?v=uWUyhxciTOs)

# load sitemaps module
>>> from trafilatura import sitemaps

# automatically find sitemaps by providing the homepage
>>> mylinks = sitemaps.sitemap_search('https://www.theguardian.com/')

# the target_lang argument works as explained above
>>> mylinks = sitemaps.sitemap_search('https://www.un.org/', target_lang='en')

The links are also seamlessly filtered for patterns given by the user, e.g. using `https://www.theguardian.com/society` as argument implies taking all URLs corresponding to the society category.

### Web crawling[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#web-crawling "Link to this heading")

See the [documentation page on web crawling](https://trafilatura.readthedocs.io/en/latest/crawls.html) for more information.

Hint

For more information on how to refine and filter a URL collection, see the underlying [courlan](https://github.com/adbar/courlan) library.

## Deprecations[#](https://trafilatura.readthedocs.io/en/latest/usage-python.html#deprecations "Link to this heading")

The following functions and arguments are deprecated:

*   extraction:
    *   `process_record()` function → use `extract()` instead

    *   `csv_output`, `json_output`, `tei_output`, `xml_output` → use `output_format` parameter instead

    *   `bare_extraction(as_dict=True)` → the function returns a `Document` object, use `.as_dict()` method on it

    *   `bare_extraction()` and `extract()`: `no_fallback` → use `fast` instead

    *   `max_tree_size` parameter moved to `settings.cfg` file

*   downloads: `decode` argument in `fetch_url()` → use `fetch_response` instead

*   utils: `decode_response()` function → use `decode_file()` instead

*   metadata: `with_metadata` (include metadata) had once the effect of today’s `only_with_metadata` (only documents with necessary metadata)
