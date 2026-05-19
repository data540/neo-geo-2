---
title: "Flight - Schema.org Type"
description: "Schema.org Type: Flight - An airline flight."
url: "https://schema.org/Flight"
---

**Note**: You are viewing the development version of [Schema.org](https://schema.org/). See [how we work](https://schema.org/docs/howwework.html) for more details.

A Schema.org Type

An airline flight.

| Property | Expected Type | Description |
| --- | --- | --- |
| Properties from [Flight](https://schema.org/Flight "Flight") |
| ``` aircraft ``` | [Text](https://schema.org/Text "Text") or [Vehicle](https://schema.org/Vehicle "Vehicle") | The kind of aircraft (e.g., "Boeing 747"). |
| ``` arrivalAirport ``` | [Airport](https://schema.org/Airport "Airport") | The airport where the flight terminates. |
| ``` arrivalGate ``` | [Text](https://schema.org/Text "Text") | Identifier of the flight's arrival gate. |
| ``` arrivalTerminal ``` | [Text](https://schema.org/Text "Text") | Identifier of the flight's arrival terminal. |
| ``` boardingPolicy ``` | [BoardingPolicyType](https://schema.org/BoardingPolicyType "BoardingPolicyType") | The type of boarding policy used by the airline (e.g. zone-based or group-based). |
| ``` departureAirport ``` | [Airport](https://schema.org/Airport "Airport") | The airport where the flight originates. |
| ``` departureGate ``` | [Text](https://schema.org/Text "Text") | Identifier of the flight's departure gate. |
| ``` departureTerminal ``` | [Text](https://schema.org/Text "Text") | Identifier of the flight's departure terminal. |
| ``` estimatedFlightDuration ``` | [Duration](https://schema.org/Duration "Duration") or [Text](https://schema.org/Text "Text") | The estimated time the flight will take. |
| ``` flightDistance ``` | [Distance](https://schema.org/Distance "Distance") or [Text](https://schema.org/Text "Text") | The distance of the flight. |
| ``` flightNumber ``` | [Text](https://schema.org/Text "Text") | The unique identifier for a flight including the airline IATA code. For example, if describing United flight 110, where the IATA code for United is 'UA', the flightNumber is 'UA110'. |
| ``` mealService ``` | [Text](https://schema.org/Text "Text") | Description of the meals that will be provided or available for purchase. |
| ``` seller ``` | [Organization](https://schema.org/Organization "Organization") or [Person](https://schema.org/Person "Person") | An entity which offers (sells / leases / lends / loans) the services / goods. A seller may also be a provider. Supersedes [vendor](https://schema.org/vendor "vendor"), [merchant](https://schema.org/merchant "merchant"). |
| ``` webCheckinTime ``` | [DateTime](https://schema.org/DateTime "DateTime") | The time when a passenger can check into the flight online. |
| Properties from [Trip](https://schema.org/Trip "Trip") |
| ``` arrivalTime ``` | [DateTime](https://schema.org/DateTime "DateTime") or [Time](https://schema.org/Time "Time") | The expected arrival time. |
| ``` departureTime ``` | [DateTime](https://schema.org/DateTime "DateTime") or [Time](https://schema.org/Time "Time") | The expected departure time. |
| ``` itinerary ``` | [ItemList](https://schema.org/ItemList "ItemList") or [Place](https://schema.org/Place "Place") | Destination(s) ( [Place](https://schema.org/Place) ) that make up a trip. For a trip where destination order is important use [ItemList](https://schema.org/ItemList) to specify that order (see examples). |
| ``` offers ``` | [Demand](https://schema.org/Demand "Demand") or [Offer](https://schema.org/Offer "Offer") | An offer to provide this item—for example, an offer to sell a product, rent the DVD of a movie, perform a service, or give away tickets to an event. Use [businessFunction](https://schema.org/businessFunction) to indicate the kind of transaction offered, i.e. sell, lease, etc. This property can also be used to describe a [Demand](https://schema.org/Demand). While this property is listed as expected on a number of common types, it can be used in others. In that case, using a second type, such as Product or a subtype of Product, can clarify the nature of the offer. Inverse property: [itemOffered](https://schema.org/itemOffered "itemOffered") |
| ``` partOfTrip ``` | [Trip](https://schema.org/Trip "Trip") | Identifies that this [Trip](https://schema.org/Trip) is a subTrip of another Trip. For example Day 1, Day 2, etc. of a multi-day trip. Inverse property: [subTrip](https://schema.org/subTrip "subTrip") |
| ``` provider ``` | [Organization](https://schema.org/Organization "Organization") or [Person](https://schema.org/Person "Person") | The service provider, service operator, or service performer; the goods producer. Another party (a seller) may offer those services or goods on behalf of the provider. A provider may also serve as the seller. Supersedes [carrier](https://schema.org/carrier "carrier"). |
| ``` subTrip ``` | [Trip](https://schema.org/Trip "Trip") | Identifies a [Trip](https://schema.org/Trip) that is a subTrip of this Trip. For example Day 1, Day 2, etc. of a multi-day trip. Inverse property: [partOfTrip](https://schema.org/partOfTrip "partOfTrip") |
| ``` tripOrigin ``` | [Place](https://schema.org/Place "Place") | The location of origin of the trip, prior to any destination(s). |
| Properties from [Thing](https://schema.org/Thing "Thing") |
| ``` additionalType ``` | [Text](https://schema.org/Text "Text") or [URL](https://schema.org/URL "URL") | An additional type for the item, typically used for adding more specific types from external vocabularies in microdata syntax. This is a relationship between something and a class that the thing is in. Typically the value is a URI-identified RDF class, and in this case corresponds to the use of rdf:type in RDF. Text values can be used sparingly, for cases where useful information can be added without their being an appropriate schema to reference. In the case of text values, the class label should follow the schema.org [style guide](https://schema.org/docs/styleguide.html). |
| ``` alternateName ``` | [Text](https://schema.org/Text "Text") | An alias for the item. |
| ``` description ``` | [Text](https://schema.org/Text "Text") or [TextObject](https://schema.org/TextObject "TextObject") | A description of the item. |
| ``` disambiguatingDescription ``` | [Text](https://schema.org/Text "Text") | A sub property of description. A short description of the item used to disambiguate from other, similar items. Information from other properties (in particular, name) may be necessary for the description to be useful for disambiguation. |
| ``` identifier ``` | [PropertyValue](https://schema.org/PropertyValue "PropertyValue") or [Text](https://schema.org/Text "Text") or [URL](https://schema.org/URL "URL") | The identifier property represents any kind of identifier for any kind of [Thing](https://schema.org/Thing), such as ISBNs, GTIN codes, UUIDs etc. Schema.org provides dedicated properties for representing many of these, either as textual strings or as URL (URI) links. See [background notes](https://schema.org/docs/datamodel.html#identifierBg) for more details. |
| ``` image ``` | [ImageObject](https://schema.org/ImageObject "ImageObject") or [URL](https://schema.org/URL "URL") | An image of the item. This can be a [URL](https://schema.org/URL) or a fully described [ImageObject](https://schema.org/ImageObject). |
| ``` mainEntityOfPage ``` | [CreativeWork](https://schema.org/CreativeWork "CreativeWork") or [URL](https://schema.org/URL "URL") | Indicates a page (or other CreativeWork) for which this thing is the main entity being described. See [background notes](https://schema.org/docs/datamodel.html#mainEntityBackground) for details. Inverse property: [mainEntity](https://schema.org/mainEntity "mainEntity") |
| ``` name ``` | [Text](https://schema.org/Text "Text") | The name of the item. |
| ``` owner ``` | [Organization](https://schema.org/Organization "Organization") or [Person](https://schema.org/Person "Person") | A person or organization who owns this Thing. Inverse property: [owns](https://schema.org/owns "owns") |
| ``` potentialAction ``` | [Action](https://schema.org/Action "Action") | Indicates a potential Action, which describes an idealized action in which this thing would play an 'object' role. |
| ``` sameAs ``` | [URL](https://schema.org/URL "URL") | URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Wikidata entry, or official website. |
| ``` subjectOf ``` | [CreativeWork](https://schema.org/CreativeWork "CreativeWork") or [Event](https://schema.org/Event "Event") | A CreativeWork or Event about this Thing. Inverse property: [about](https://schema.org/about "about") |
| ``` url ``` | [URL](https://schema.org/URL "URL") | URL of the item. |

### Examples

Example notes or example HTML without markup.

1.   Reservation #RXJ34P

2.   Passenger: Eva Green

3.   Flight: United Airlines Flight 110

4.   Operated By: Continental Airlines

5.   Departing: San Francisco Airport (SFO) 2017-03-04T20:15:00-08:00

6.   Arriving: John F. Kennedy International Airport (JFK) 2017-03-05T06:30:00-05:00

7.   Passenger Sequence Number: ABC123

8.   Boarding priority: FastTrack

9.   Boarding policy: zone-based

10.   Security screening: TSA PreCheck

Example encoded as [JSON-LD](https://en.wikipedia.org/wiki/JSON-LD) in a HTML script tag.

1.   <script type="application/ld+json">

2.   {

3.    "@context": "https://schema.org",

4.    "@type": "FlightReservation",

5.    "reservationId": "RXJ34P",

6.    "reservationStatus": "https://schema.org/ReservationConfirmed",

7.    "passengerPriorityStatus": "Fast Track",

8.    "passengerSequenceNumber": "ABC123",

9.    "securityScreening": "TSA PreCheck",

10.    "underName": {

11.     "@type": "Person",

12.     "name": "Eva Green"

13.    },

14.    "reservationFor": {

15.     "@type": "Flight",

16.     "flightNumber": "UA110",

17.     "provider": {

18.      "@type": "Airline",

19.      "name": "Continental",

20.      "iataCode": "CO",

21.      "boardingPolicy": "https://schema.org/ZoneBoardingPolicy"

22.     },

23.     "seller": {

24.      "@type": "Airline",

25.      "name": "United",

26.      "iataCode": "UA"

27.     },

28.     "departureAirport": {

29.      "@type": "Airport",

30.      "name": "San Francisco Airport",

31.      "iataCode": "SFO"

32.     },

33.     "departureTime": "2017-03-04T20:15:00-08:00",

34.     "arrivalAirport": {

35.      "@type": "Airport",

36.      "name": "John F. Kennedy International Airport",

37.      "iataCode": "JFK"

38.     },

39.     "arrivalTime": "2017-03-05T06:30:00-05:00"

40.    }

41.   }

42.   </script>

Structured representation of the JSON-LD example.
