---
title: "Hybrid search | Weaviate Documentation"
description: "Combined vector (semantic) and keyword search leveraging semantic similarity and exact keyword matching strengths."
url: "https://docs.weaviate.io/weaviate/concepts/search/hybrid-search"
---

Hybrid search combines [vector search](https://docs.weaviate.io/weaviate/concepts/search/vector-search) and [keyword search (BM25)](https://docs.weaviate.io/weaviate/concepts/search/keyword-search) to leverage the strengths of both approaches. This takes into account results' semantic similarity (vector search) and exact keyword relevance (BM25), providing more comprehensive search results.

A hybrid search runs both search types in parallel and combines their scores to produce a final ranking of results. This makes it versatile and robust, suitable for a wide range of search use cases.

## How hybrid search works[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#how-hybrid-search-works "Direct link to How hybrid search works")

In Weaviate, a hybrid search performs the following steps:

1.   Executes both searches in parallel: 
    *   Vector search to find semantically similar content
    *   BM25 search to find keyword matches

2.   Combines the normalized scores using a [fusion method](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#fusion-strategies)
3.   Returns results ranked by the combined scores

### Fusion strategies[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#fusion-strategies "Direct link to Fusion strategies")

Weaviate supports two strategies (`relativeScoreFusion` and `rankedFusion`) for combining vector and keyword search scores:

With `relativeScoreFusion` (default from `v1.24`), each object is scored by _normalizing_ the metrics output by the vector search and keyword search respectively. The highest value becomes 1, the lowest value becomes 0, and others end up in between according to this scale. The total score is thus calculated by a scaled sum of normalized vector distance and normalized BM25 score.

With `rankedFusion` (default for `v1.23` and lower), each object is scored according to its position in the results for the given search, starting from the highest score for the top-ranked object and decreasing down the order. The total score is calculated by adding these rank-based scores from the vector and keyword searches.

Generally, `relativeScoreFusion` might be a a good choice, which is why it is the default.

The main reason is that `relativeScoreFusion` retains more information from the original searches than `rankedFusion`, which only retains the rankings. More generally we believe that the nuances captured in the vector and keyword search metrics are more likely to be reflected in rankings produced by `relativeScoreFusion`.

We include a concrete example of the two fusion strategies below.

### Fusion example[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#fusion-example "Direct link to Fusion example")

Let's say that a search returns **five objects** with **document id** (from 0 to 4), and **scores** from **keyword** and **vector search**, **ordered by score**:

| Search Type | (id): score | (id): score | (id): score | (id): score | (id): score |
| --- | --- | --- | --- | --- | --- |
| Keyword | (1): 5 | (0): 2.6 | (2): 2.3 | (4): 0.2 | (3): 0.09 |
| Vector | (2): 0.6 | (4): 0.598 | (0): 0.596 | (1): 0.594 | (3): 0.009 |

#### Ranked fusion[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#ranked-fusion "Direct link to Ranked fusion")

The score depends on the rank of each result and is computed according to `1/(RANK + 60)`, resulting in:

| Search Type | (id): score | (id): score | (id): score | (id): score | (id): score |
| --- | --- | --- | --- | --- | --- |
| Keyword | (1): 0.0154 | (0): 0.0160 | (2): 0.0161 | (4): 0.0167 | (3): 0.0166 |
| Vector | (2): 0.016502 | (4): 0.016502 | (0): 0.016503 | (1): 0.016503 | (3): 0.016666 |

As you can see, the results for each rank are identical, regardless of the input score.

#### Relative score fusion[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#relative-score-fusion "Direct link to Relative score fusion")

In relative score fusion, the largest score is set to 1 and the lowest to 0, and all entries in-between are scaled according to their **relative distance** to the **maximum** and **minimum values**.

| Search Type | (id): score | (id): score | (id): score | (id): score | (id): score |
| --- | --- | --- | --- | --- | --- |
| Keyword | (1): 1.0 | (0): 0.511 | (2): 0.450 | (4): 0.022 | (3): 0.0 |
| Vector | (2): 1.0 | (4): 0.996 | (0): 0.993 | (1): 0.986 | (3): 0.0 |

The scores therefore reflect the relative distribution of the original scores. For example, the vector search scores of the first 4 documents were almost identical, which is still the case for the normalized scores.

#### Comparison[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#comparison "Direct link to Comparison")

For the vector search, the scores for the top 4 objects (**IDs 2, 4, 0, 1**) were almost identical, and all of them were good results. While for the keyword search, one object (**ID 1**) was much better than the rest.

This is captured in the final result of `relativeScoreFusion`, which identified the object **ID 1** the top result. This is justified because this document was the best result in the keyword search with a big gap to the next-best score and in the top group of vector search.

In contrast, for `rankedFusion`, the object **ID 2** is the top result, closely followed by objects **ID 1** and **ID 0**.

### Alpha parameter[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#alpha-parameter "Direct link to Alpha parameter")

The alpha value determines the weight of the vector search results in the final hybrid search results. The alpha value can range from 0 to 1:

*   `alpha = 0.5` (default): Equal weight to both searches
*   `alpha > 0.5`: More weight to vector search
*   `alpha < 0.5`: More weight to keyword search

## Search thresholds[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#search-thresholds "Direct link to Search thresholds")

Hybrid search supports a maximum vector distance threshold through the `max vector distance` parameter.

This threshold applies only to the vector search component of the hybrid search, allowing you to filter out results that are too dissimilar in vector space, regardless of their keyword search scores.

For example, consider a maximum vector distance of `0.3`. This means objects with a vector distance higher than `0.3` will be excluded from the hybrid search results, even if they have high keyword search scores.

This can be useful when you want to ensure semantic similarity meets a minimum standard while still taking advantage of keyword matching.

There is no equivalent threshold parameter for the keyword (BM25) component of hybrid search or the final combined scores.

This is because BM25 scores are not normalized or bounded like vector distances, making a universal threshold less meaningful.

## Keyword (BM25) search parameters[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#keyword-bm25-search-parameters "Direct link to Keyword (BM25) search parameters")

Hybrid search in Weaviate supports all the parameters available for keyword (BM25) search. This includes, for example, the ability to set the tokenization method, stopwords, BM25 parameters (k1, b), search operators (`and` or `or`), specific properties to search and/or to boost particular properties.

For more information on these parameters, see the [keyword search page](https://docs.weaviate.io/weaviate/concepts/search/keyword-search).

## Further resources[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#further-resources "Direct link to Further resources")

*   [How-to: Search](https://docs.weaviate.io/weaviate/search)
*   [How-to: Hybrid search](https://docs.weaviate.io/weaviate/search/hybrid)
*   [Blog: A deep dive into Weaviate's fusion algorithms](https://weaviate.io/blog/hybrid-search-fusion-algorithms)

## Questions and feedback[​](https://docs.weaviate.io/weaviate/concepts/search/hybrid-search#questions-and-feedback "Direct link to Questions and feedback")

If you have any questions or feedback, let us know in the [user forum](https://forum.weaviate.io/).
