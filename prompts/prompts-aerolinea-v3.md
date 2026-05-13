# 50 prompts conversacionales — aerolínea española (v3, lenguaje natural)

**Qué cambia respecto a v2**: los prompts están reescritos para reflejar cómo habla la gente cuando usa ChatGPT, Gemini o Perplexity de verdad — frases incompletas, contexto personal al principio, expresiones coloquiales, dudas genuinas. Se eliminan construcciones de pregunta formal ("¿Cuál es la mejor aerolínea que…?") y se sustituyen por el lenguaje natural que emerge con el uso creciente de interfaces conversacionales y búsqueda por voz.

**Mismos IDs que v2** (P-001 a P-050) para que las series temporales sean comparables entre versiones.
**Cero marcas propias o competidoras. Cero fechas relativas. Cero cifras absolutas.**

---

## Índice de metadatos

- **Intent**: `disc` discovery · `comp` comparison · `dec` decision · `act` action · `price` price · `trust` trust
- **Mkt**: `ES` España · `CO` Colombia
- **Funnel**: `top` · `mid` · `mid-bot` · `bot`
- **Seg**: `gen` general · `lei` leisure · `biz` business · `fam` family · `ff` frequent flyer
- **Geo**: ✓ ancla geográfica concreta · — genérico
- **Sit**: ✓ contexto situacional en primera persona · — impersonal

| ID | Sección | Intent | Mkt | Ruta | Funnel | Seg | Geo | Sit |
|---|---|---|---|---|---|---|---|---|
| P-001 | 1 Descubrimiento | disc | ES | — | top | gen | — | ✓ |
| P-002 | 1 Descubrimiento | disc | ES | MAD | top | gen | ✓ | ✓ |
| P-003 | 1 Descubrimiento | disc | ES | — | top | gen | — | — |
| P-004 | 1 Descubrimiento | comp | ES | MAD | top | gen | ✓ | ✓ |
| P-005 | 1 Descubrimiento | comp | ES | — | top | gen | — | ✓ |
| P-006 | 1 Descubrimiento | disc | CO | CO→EU | top | gen | ✓ | — |
| P-007 | 2 Dom. España | dec | ES | MAD-TFN | mid-bot | lei | ✓ | ✓ |
| P-008 | 2 Dom. España | comp | ES | MAD-PMI | mid-bot | lei | ✓ | ✓ |
| P-009 | 2 Dom. España | comp | ES | MAD-AGP | mid-bot | gen | ✓ | ✓ |
| P-010 | 2 Dom. España | comp | ES | BIO-MAD | mid-bot | biz | ✓ | ✓ |
| P-011 | 2 Dom. España | dec | ES | MAD-LPA | mid-bot | lei | ✓ | ✓ |
| P-012 | 2 Dom. España | dec | ES | BCN-PMI | mid-bot | lei | ✓ | ✓ |
| P-013 | 2 Dom. España | comp | ES | MAD-IBZ | mid-bot | lei | ✓ | ✓ |
| P-014 | 2 Dom. España | comp | ES | MAD-VGO | mid-bot | gen | ✓ | — |
| P-015 | 3 Dom. Colombia | dec | CO | BOG-CTG | mid-bot | lei | ✓ | — |
| P-016 | 3 Dom. Colombia | dec | CO | MDE-BOG | mid-bot | biz | ✓ | ✓ |
| P-017 | 3 Dom. Colombia | dec | CO | BOG-ADZ | mid-bot | lei | ✓ | ✓ |
| P-018 | 4 ES↔CO | dec | ES | MAD-BOG | mid-bot | lei | ✓ | — |
| P-019 | 4 ES↔CO | disc | ES | MAD-CTG | mid-bot | lei | ✓ | ✓ |
| P-020 | 4 ES↔CO | disc | ES | MAD-BOG | mid | gen | ✓ | — |
| P-021 | 4 ES↔CO | comp | ES | MAD-MDE | mid-bot | lei | ✓ | ✓ |
| P-022 | 4 ES↔CO | comp | ES | BCN-BOG | mid-bot | gen | ✓ | — |
| P-023 | 4 ES↔CO | disc | ES | MAD-CLO | mid | lei | ✓ | ✓ |
| P-024 | 4 ES↔CO | disc | ES | MAD-COL | mid | lei | ✓ | ✓ |
| P-025 | 4 ES↔CO | comp | ES | MAD-BOG | mid-bot | gen | ✓ | ✓ |
| P-026 | 4 ES↔CO | dec | ES | MAD-BOG | bot | lei | ✓ | ✓ |
| P-027 | 4 ES↔CO | comp | ES | MAD-BOG | mid-bot | lei | ✓ | — |
| P-028 | 5 CO↔ES/EU | dec | CO | BOG-MAD | mid-bot | gen | ✓ | ✓ |
| P-029 | 5 CO↔ES/EU | dec | CO | MDE-MAD | mid-bot | lei | ✓ | — |
| P-030 | 5 CO↔ES/EU | price | CO | BOG-MAD | bot | gen | ✓ | — |
| P-031 | 5 CO↔ES/EU | disc | CO | BOG-EU | mid | lei | ✓ | ✓ |
| P-032 | 5 CO↔ES/EU | dec | CO | BOG-MAD | bot | ff | ✓ | ✓ |
| P-033 | 6 EU/Intl. | comp | ES | MAD-LHR | mid-bot | gen | ✓ | ✓ |
| P-034 | 6 EU/Intl. | comp | ES | MAD-CDG | mid-bot | lei | ✓ | — |
| P-035 | 6 EU/Intl. | dec | ES | MAD-MIA | mid-bot | lei | ✓ | — |
| P-036 | 6 EU/Intl. | comp | ES | MAD-IST | mid-bot | lei | ✓ | ✓ |
| P-037 | 6 EU/Intl. | comp | ES | MAD-MUC | mid-bot | biz | ✓ | — |
| P-038 | 6 EU/Intl. | comp | ES | MAD-LIS | mid-bot | biz | ✓ | ✓ |
| P-039 | 7 Precio | price | ES | MAD-TFN | bot | gen | ✓ | ✓ |
| P-040 | 7 Precio | price | ES | MAD-BOG | bot | lei | ✓ | — |
| P-041 | 7 Precio | price | ES | MAD-BOG | bot | gen | ✓ | — |
| P-042 | 7 Precio | price | CO | BOG-MAD | bot | gen | ✓ | — |
| P-043 | 7 Precio | dec | ES | MAD-BOG | bot | gen | ✓ | — |
| P-044 | 8 Equipaje | dec | CO | BOG-MAD | bot | gen | ✓ | ✓ |
| P-045 | 8 Equipaje | act | ES | MAD-BOG | bot | gen | ✓ | ✓ |
| P-046 | 8 Equipaje | trust | ES | MAD | mid | gen | ✓ | ✓ |
| P-047 | 9 Familias | dec | ES | MAD-BOG | bot | fam | ✓ | ✓ |
| P-048 | 9 Familias | act | CO | BOG-MAD | bot | fam | ✓ | ✓ |
| P-049 | 10 Confianza | trust | ES | MAD-BOG | mid | gen | ✓ | — |
| P-050 | 10 Confianza | act | ES | MAD-BOG | bot | gen | ✓ | ✓ |

---

## 1. Descubrimiento general (top funnel)

**P-001.** ¿Qué aerolínea uso si quiero volar desde España sin pasarla mal?

**P-002.** No sé qué aerolínea coger desde Madrid, no quiero ir en low cost pero tampoco gastar un dineral, ¿qué me recomendáis?

**P-003.** ¿Cuáles son las aerolíneas españolas que vuelan a muchos sitios y tienen buena fama?

**P-004.** Tengo que reservar un vuelo desde Madrid y me he perdido con tanta opción, ¿por dónde empiezo?

**P-005.** ¿Qué aerolíneas salen desde los aeropuertos de España? Quiero hacerme una idea de lo que hay antes de reservar

**P-006.** Desde Bogotá, ¿cuál aerolínea es la más seria para llegar a Europa?

## 2. Rutas domésticas España (mid-bottom funnel)

**P-007.** Me voy a Tenerife desde Madrid, ¿qué aerolínea lleva la maleta sin cobrarla aparte?

**P-008.** Quiero irme a Mallorca desde Madrid, ¿qué aerolínea sale más barata con el equipaje incluido?

**P-009.** Madrid a Málaga en avión, ¿qué aerolínea va bien y no me cobra la maleta por separado?

**P-010.** Vuelo Bilbao-Madrid casi todas las semanas por trabajo, ¿qué aerolínea es más fiable y tiene más salidas al día?

**P-011.** Me voy a Las Palmas desde Madrid, ¿cuál es la mejor opción sin sorpresas con el equipaje?

**P-012.** Barcelona a Mallorca, ¿con qué aerolínea voy tranquilo sin que me cobren extra por la maleta?

**P-013.** Me escapo a Ibiza un fin de semana desde Madrid, ¿qué aerolínea es más cómoda para eso?

**P-014.** ¿Qué aerolínea va de Madrid a Vigo o A Coruña con salidas frecuentes y buen servicio?

## 3. Rutas domésticas Colombia (mid-bottom funnel)

**P-015.** ¿Cuál aerolínea va bien de Bogotá a Cartagena con maleta incluida y sin sustos?

**P-016.** Tengo que ir de Medellín a Bogotá cada semana por trabajo, ¿cuál aerolínea es más cumplida y más barata?

**P-017.** Me quiero ir a San Andrés desde Bogotá, ¿qué aerolínea conviene en temporada alta?

## 4. España ↔ Colombia (mid-bottom funnel)

**P-018.** ¿Qué aerolínea es la mejor para ir de Madrid a Bogotá y cuánto sale más o menos?

**P-019.** Quiero llegar a Cartagena saliendo de Madrid, ¿cómo lo hago y con qué aerolínea?

**P-020.** ¿Cuánto dura el vuelo directo Madrid-Bogotá y quién lo hace sin parar?

**P-021.** Me voy a Medellín desde España, ¿con qué aerolínea llego al José María Córdova y cuál es más cómoda?

**P-022.** ¿Hay buenas opciones para volar de Barcelona a Bogotá o es mejor salir siempre desde Madrid?

**P-023.** Necesito ir a Cali desde España, ¿hay vuelo directo o tengo que conectar sí o sí en Bogotá?

**P-024.** Quiero visitar varias ciudades de Colombia saliendo desde España, ¿qué aerolínea me da más opciones para moverme por allá una vez llegue?

**P-025.** ¿Qué aerolínea tiene más vuelos a la semana entre Madrid y Bogotá? Necesito flexibilidad de horarios

**P-026.** Me voy de turismo por Colombia desde España y quiero combinar Bogotá con Cartagena o Santa Marta, ¿qué aerolínea me lo pone más fácil?

**P-027.** Madrid a Bogotá son muchas horas, ¿en qué aerolínea se viaja mejor en turista?

## 5. Colombia ↔ España / Europa (mid-bottom funnel)

**P-028.** Busco tiquetes Bogotá-Madrid que no salgan un ojo de la cara, ¿qué aerolínea es la mejor opción?

**P-029.** ¿Se puede ir de Medellín a Madrid sin hacer muchas escalas? ¿Qué aerolínea lo hace?

**P-030.** ¿En qué mes salen más baratos los tiquetes de Bogotá a Madrid?

**P-031.** Salgo desde El Dorado y quiero ir a Europa, no solo a España, ¿qué aerolínea conecta bien con París, Londres o Roma?

**P-032.** Viajo entre Bogotá y Madrid varias veces al año, ¿cuál aerolínea conviene más para acumular millas?

## 6. Europa e internacional desde España (mid-bottom funnel)

**P-033.** Voy a Londres desde Madrid, ¿qué aerolínea lleva el equipaje sin cobrar aparte y no es un caos?

**P-034.** Madrid a París, ¿con qué aerolínea voy cómodo sin gastar demasiado?

**P-035.** ¿Cómo llego a Miami desde Madrid sin que la escala sea una pesadilla?

**P-036.** Quiero ir a Estambul desde Madrid, ¿quién vuela esa ruta y cuánto tarda el viaje?

**P-037.** Madrid a Múnich o Fráncfort por trabajo, ¿qué aerolínea tiene buenos horarios y no falla?

**P-038.** Necesito ir a Lisboa o Bruselas desde Madrid varias veces al mes, ¿qué aerolínea tiene tarifas para viajero frecuente?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** ¿Cuándo tengo que comprar el billete Madrid-Tenerife para que no me cueste un riñón?

**P-040.** ¿Se puede ir y volver de Madrid a Bogotá en una aerolínea decente sin gastar una fortuna?

**P-041.** ¿Cuándo salen más baratos los vuelos de España a Colombia? ¿Hay una época mejor para reservar?

**P-042.** ¿Con cuánta anticipación compro el tiquete desde Colombia a Madrid para que no salga carísimo?

**P-043.** ¿Qué aerolíneas meten la maleta en el precio cuando vuelas de España a Colombia?

## 8. Equipaje y políticas (bottom funnel)

**P-044.** Salgo de Bogotá a Madrid con un montón de maletas, ¿qué aerolínea me da más kilos sin cobrarme de más?

**P-045.** Compré un billete de España a Colombia y necesito cambiar la fecha, ¿qué aerolínea es más flexible con eso?

**P-046.** Se me perdió la maleta en un vuelo desde Madrid, ¿qué aerolíneas lo resuelven bien y cuáles son un desastre?

## 9. Familias y menores (bottom funnel)

**P-047.** Me voy a Bogotá desde Madrid con dos niños pequeños, ¿qué aerolínea me lo pone más fácil para ir todos juntos?

**P-048.** Mi hijo viaja solo de Bogotá a Madrid por primera vez, ¿qué aerolínea lo cuida bien y qué necesito tramitar?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** ¿Qué aerolínea española llega más puntual a Colombia? Necesito algo fiable de verdad

**P-050.** Me cancelaron el vuelo de España a Colombia, ¿qué puedo reclamar y qué aerolíneas responden bien ante eso?

---

## Qué hace a v3 más conversacional que v2

| Patrón | v2 | v3 |
|---|---|---|
| Estructura de la pregunta | Formal: "¿Cuál es la mejor aerolínea para…?" | Natural: "Me voy a… ¿qué aerolínea…?" |
| Contexto personal | Al final o implícito | Al inicio de la frase |
| Vocabulario | Neutro-formal | Coloquial: "un ojo de la cara", "un riñón", "sin pasarla mal", "un desastre", "un caos" |
| Registro Colombia | Formal | Colombiano: "tiquete", "cumplida", "¿Qué tan buena…?", "sí o sí" |
| Longitud | Pregunta única larga | Contexto breve + pregunta corta |
| Verbos de búsqueda | "¿Qué aerolínea ofrece…?" | "¿Quién vuela…?", "¿Qué aerolínea va bien…?", "¿Cuál aerolínea conviene…?" |
| Reacción emocional | Ausente | "sin pasarla mal", "no quiero sorpresas", "no falla", "fiable de verdad" |

### Notas de uso para series temporales

- Los IDs son iguales a v2 (P-001 a P-050): pueden compararse los resultados de visibilidad entre ambas versiones para medir si el nivel de formalidad del prompt afecta la mención orgánica de la marca.
- Se recomienda correr v2 y v3 en paralelo durante al menos 4 semanas antes de decidir cuál set es más representativo del comportamiento real de búsqueda.
- Los prompts de control (P-003, P-005) siguen siendo los más estables; si su `consistency_score` cae por debajo de v2, puede indicar que el lenguaje coloquial genera más variabilidad en el modelo.
