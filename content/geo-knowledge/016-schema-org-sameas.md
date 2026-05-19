---
title: "sameAs - Schema.org Property"
description: "Schema.org Property: sameAs - URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Wikidata entry, or official website."
url: "https://schema.org/sameAs"
---

**Note**: You are viewing the development version of [Schema.org](https://schema.org/). See [how we work](https://schema.org/docs/howwework.html) for more details.

A Schema.org Property

URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Wikidata entry, or official website.

### Values expected to be one of these types

```
URL
```

### Used on these types

```
Thing
```

### Examples

Example notes or example HTML without markup.

1.   <!-- Utilising Wikidata as a source of URIs for entities in a sameAs relationship -->

Example encoded as [JSON-LD](https://en.wikipedia.org/wiki/JSON-LD) in a HTML script tag.

1.   <script type="application/ld+json">

2.   {

3.    "@context": "https://schema.org",

4.    "@type": "Movie",

5.    "name": "The Hitchhiker's Guide to the Galaxy",

6.    "disambiguatingDescription": "2005 British-American comic science fiction film directed by Garth Jennings",

7.    "sameAs": "https://www.wikidata.org/wiki/Q836821",

8.    "titleEIDR": "10.5240/B752-5B47-DBBE-E5D4-5A3F-N",

9.    "isBasedOn":

10.    {

11.     "@type": "Book",

12.     "name": "The Hitchhiker's Guide to the Galaxy",

13.     "isbn": "0-330-25864-8",

14.     "sameAs": "https://www.wikidata.org/wiki/Q3107329",

15.     "author":

16.     {

17.      "@type": "Person",

18.      "name": "Douglas Adams",

19.      "sameAs": "https://www.wikidata.org/wiki/Q42"

20.     }

21.    }

22.   }

23.   </script>

Structured representation of the JSON-LD example.
