---
title: "Google Knowledge Graph Search API"
description: "Discover the use cases and explore example requests for the API that lets you find entities in the Google Knowledge Graph."
url: "https://developers.google.com/knowledge-graph"
publishedTime: "Fri, 26 Apr 2024 16:50:58 GMT"
---

The Knowledge Graph Search API lets you find entities in the [Google Knowledge Graph](https://googleblog.blogspot.com/2012/05/introducing-knowledge-graph-things-not.html). The API uses standard [schema.org](http://schema.org/) types and is compliant with the [JSON-LD](http://json-ld.org/) specification.

## Typical use cases

Some examples of how you can use the Knowledge Graph Search API include:

*   Getting a ranked list of the most notable entities that match certain criteria.
*   Predictively completing entities in a search box.
*   Annotating/organizing content using the Knowledge Graph entities.

For detailed information about the API methods and parameters, see the [API Reference](https://developers.google.com/knowledge-graph/reference/rest/v1).

## Sample request

The following example shows one kind of request you can send to the API. (But check the [Prerequisites](https://developers.google.com/knowledge-graph/prereqs) section first. You'll also need to insert your own API key.)

https://kgsearch.googleapis.com/v1/entities:search?query=taylor+swift&key=API_KEY&limit=1&indent=True
The sample search above returns a JSON-LD result similar to the following:

`{  "@context": {    "@vocab": "http://schema.org/",    "goog": "http://schema.googleapis.com/",    "resultScore": "goog:resultScore",    "detailedDescription": "goog:detailedDescription",    "EntitySearchResult": "goog:EntitySearchResult",    "kg": "http://g.co/kg"  },  "@type": "ItemList",  "itemListElement": [    {      "@type": "EntitySearchResult",      "result": {        "@id": "kg:/m/0dl567",        "name": "Taylor Swift",        "@type": [          "Thing",          "Person"        ],        "description": "Singer-songwriter",        "image": {          "contentUrl": "https://t1.gstatic.com/images?q=tbn:ANd9GcQmVDAhjhWnN2OWys2ZMO3PGAhupp5tN2LwF_BJmiHgi19hf8Ku",          "url": "https://en.wikipedia.org/wiki/Taylor_Swift",          "license": "http://creativecommons.org/licenses/by-sa/2.0"        },        "detailedDescription": {          "articleBody": "Taylor Alison Swift is an American singer-songwriter and actress. Raised in Wyomissing, Pennsylvania, she moved to Nashville, Tennessee, at the age of 14 to pursue a career in country music. ",          "url": "http://en.wikipedia.org/wiki/Taylor_Swift",          "license": "https://en.wikipedia.org/wiki/Wikipedia:Text_of_Creative_Commons_Attribution-ShareAlike_3.0_Unported_License"        },        "url": "http://taylorswift.com/"      },      "resultScore": 4850    }  ]}`
The following code samples show how to perform a similar search in various supported languages. This search returns entries matching `Taylor Swift`.

### Python

"""Example of Python client calling Knowledge Graph Search API."""

import json

import urllib
api_key

= open('.api_key').read()

query = 'Taylor Swift'

service_url = 'https://kgsearch.googleapis.com/v1/entities:search'

params = {

  'query': query,

  'limit': 10,

  'indent': True,

  'key': api_key,

}

url = service_url + '?' + urllib.urlencode(params)

response = json.loads(urllib.urlopen(url).read())

for element in response['itemListElement']:

 print(element['result']['name'] + ' (' + str(element['resultScore']) + ')')
### Java

package com.google.knowledge.platforms.syndication.entitymatch.codesample;import com.google.api.client.http.GenericUrl;

import com.google.api.client.http.HttpRequest;

import com.google.api.client.http.HttpRequestFactory;

import com.google.api.client.http.HttpResponse;

import com.google.api.client.http.HttpTransport;

import com.google.api.client.http.javanet.NetHttpTransport;

import com.jayway.jsonpath.JsonPath;

import java.io.FileInputStream;

import java.util.Properties;

import org.json.simple.JSONArray;

import org.json.simple.JSONObject;

import org.json.simple.parser.JSONParser;/** Example of Java client calling Knowledge Graph Search API */

public class SearchExample {

 public static Properties properties = new Properties();

 public static void main(String[] args) {

  try {

   properties.load(new FileInputStream("kgsearch.properties"));HttpTransport httpTransport = new NetHttpTransport();

   HttpRequestFactory requestFactory = httpTransport.createRequestFactory();

   JSONParser parser = new JSONParser();

   GenericUrl url = new GenericUrl("https://kgsearch.googleapis.com/v1/entities:search");

   url.put("query", "Taylor Swift");

   url.put("limit", "10");

   url.put("indent", "true");

   url.put("key", properties.get("API_KEY"));

   HttpRequest request = requestFactory.buildGetRequest(url);

   HttpResponse httpResponse = request.execute();

   JSONObject response = (JSONObject) parser.parse(httpResponse.parseAsString());

   JSONArray elements = (JSONArray) response.get("itemListElement");

   for (Object element : elements) {

    System.out.println(JsonPath.read(element, "$.result.name").toString());

   }

  } catch (Exception ex) {

   ex.printStackTrace();

  }

 }

}
### Javascript

<!DOCTYPE html>

<html>

<head>

  <script src="http://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>

</head>

<body>

<script>

 var service_url = 'https://kgsearch.googleapis.com/v1/entities:search';

 var params = {

  'query': 'Taylor Swift',

  'limit': 10,

  'indent': true,

  'key' : '<put your api_key here>',

 };

 $.getJSON(service_url + '?callback=?', params, function(response) {

  $.each(response.itemListElement, function(i, element) {

   $('<div>', {text:element['result']['name']}).appendTo(document.body);

  });

 });

</script>

</body>

</html>
### PHP

<?php

require '.api_key';

$service_url = 'https://kgsearch.googleapis.com/v1/entities:search';

$params = array(

 'query' => 'Taylor Swift',

 'limit' => 10,

 'indent' => TRUE,

 'key' => $api_key);

$url = $service_url . '?' . http_build_query($params);

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, $url);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

$response = json_decode(curl_exec($ch), true);

curl_close($ch);

foreach($response['itemListElement'] as $element) {

 echo $element['result']['name'] . '<br/>';

}

## Knowledge Graph entities

The Knowledge Graph has millions of entries that describe real-world entities like people, places, and things. These entities form the nodes of the graph.

The following are some of the types of entities found in the Knowledge Graph:

*   [Book](http://schema.org/Book)
*   [BookSeries](http://schema.org/BookSeries)
*   [EducationalOrganization](http://schema.org/EducationalOrganization)
*   [Event](http://schema.org/Event)
*   [GovernmentOrganization](http://schema.org/GovernmentOrganization)
*   [LocalBusiness](http://schema.org/LocalBusiness)
*   [Movie](http://schema.org/Movie)
*   [MovieSeries](http://schema.org/MovieSeries)
*   [MusicAlbum](http://schema.org/MusicAlbum)
*   [MusicGroup](http://schema.org/MusicGroup)
*   [MusicRecording](http://schema.org/MusicRecording)
*   [Organization](http://schema.org/Organization)
*   [Periodical](http://schema.org/Periodical)
*   [Person](http://schema.org/Person)
*   [Place](http://schema.org/Place)
*   [SportsTeam](http://schema.org/SportsTeam)
*   [TVEpisode](http://schema.org/TVEpisode)
*   [TVSeries](http://schema.org/TVSeries)
*   [VideoGame](http://schema.org/VideoGame)
*   [VideoGameSeries](http://schema.org/VideoGameSeries)
*   [WebSite](http://schema.org/WebSite)
