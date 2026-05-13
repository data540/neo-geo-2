# 50 prompts optimizados para chat IA — aerolínea española (v7, ES + CO)

**Mercados**: España (principal, ~70 %) + Colombia (secundario, ~30 %).
**Uso**: serie temporal para medir evolución de SOV, posición, sentiment y consistencia en LLMs.
**Objetivo v7**: combinar lo mejor de las versiones anteriores: la naturalidad de `v5`, la claridad tipo búsqueda de `v6` y la estabilidad metodológica de `v2`. Esta versión está pensada para usuarios que escriben en un chat de IA con frases breves, intención clara y expectativa de recomendación útil.
**Criterio de redacción**: cero fechas relativas, cero cifras absolutas, cero referencias estacionales explícitas que envejezcan. Cero menciones de marca propia o competidora.

---

## Enfoque de esta versión

- Prompts más cortos que `v5`, pero menos telegráficos que `v6`.
- Lenguaje natural, directo y realista para un usuario que consulta a una IA.
- Preguntas orientadas a decisión: “qué me conviene”, “cuál elegir”, “qué opciones mirar”, “qué diferencia se nota”.
- Se mantiene la neutralidad de marca para medir aparición espontánea.
- Se conservan IDs, rutas, mercados, funnel e intención para comparabilidad longitudinal.
- Se evita sobreexplicar el contexto cuando la ruta o la necesidad ya bastan para que el LLM responda bien.

---

## Índice de metadatos

Referencia para segmentar resultados en el dashboard. Campos:
- **Intent**: `disc` discovery · `comp` comparison · `dec` decision · `act` action · `price` price · `trust` trust
- **Mkt**: `ES` España · `CO` Colombia
- **Funnel**: `top` · `mid` · `mid-bot` · `bot`
- **Seg**: `gen` general · `lei` leisure · `biz` business · `fam` family · `ff` frequent flyer
- **Geo**: ✓ contiene ancla geográfica concreta (ruta o aeropuerto) · — genérico
- **Sit**: ✓ contiene contexto situacional en primera persona · — impersonal

| ID | Sección | Intent | Mkt | Ruta | Funnel | Seg | Geo | Sit |
|---|---|---|---|---|---|---|---|---|
| P-001 | 1 Descubrimiento | disc | ES | — | top | gen | — | — |
| P-002 | 1 Descubrimiento | disc | ES | MAD | top | gen | ✓ | ✓ |
| P-003 | 1 Descubrimiento | disc | ES | — | top | gen | — | — |
| P-004 | 1 Descubrimiento | comp | ES | MAD | top | gen | ✓ | ✓ |
| P-005 | 1 Descubrimiento | comp | ES | — | top | gen | — | — |
| P-006 | 1 Descubrimiento | disc | CO | CO→EU | top | gen | ✓ | — |
| P-007 | 2 Dom. España | dec | ES | MAD-TFN | mid-bot | lei | ✓ | — |
| P-008 | 2 Dom. España | comp | ES | MAD-PMI | mid-bot | lei | ✓ | ✓ |
| P-009 | 2 Dom. España | comp | ES | MAD-AGP | mid-bot | gen | ✓ | — |
| P-010 | 2 Dom. España | comp | ES | BIO-MAD | mid-bot | biz | ✓ | ✓ |
| P-011 | 2 Dom. España | dec | ES | MAD-LPA | mid-bot | lei | ✓ | ✓ |
| P-012 | 2 Dom. España | dec | ES | BCN-PMI | mid-bot | lei | ✓ | — |
| P-013 | 2 Dom. España | comp | ES | MAD-IBZ | mid-bot | lei | ✓ | ✓ |
| P-014 | 2 Dom. España | comp | ES | MAD-VGO | mid-bot | gen | ✓ | — |
| P-015 | 3 Dom. Colombia | dec | CO | BOG-CTG | mid-bot | lei | ✓ | — |
| P-016 | 3 Dom. Colombia | dec | CO | MDE-BOG | mid-bot | biz | ✓ | ✓ |
| P-017 | 3 Dom. Colombia | dec | CO | BOG-ADZ | mid-bot | lei | ✓ | ✓ |
| P-018 | 4 ES↔CO | dec | ES | MAD-BOG | mid-bot | lei | ✓ | — |
| P-019 | 4 ES↔CO | disc | ES | MAD-CTG | mid-bot | lei | ✓ | ✓ |
| P-020 | 4 ES↔CO | disc | ES | MAD-BOG | mid | gen | ✓ | — |
| P-021 | 4 ES↔CO | comp | ES | MAD-MDE | mid-bot | lei | ✓ | ✓ |
| P-022 | 4 ES↔CO | comp | ES | BCN-BOG | mid-bot | gen | ✓ | ✓ |
| P-023 | 4 ES↔CO | disc | ES | MAD-CLO | mid | lei | ✓ | ✓ |
| P-024 | 4 ES↔CO | disc | ES | MAD-COL | mid | lei | ✓ | — |
| P-025 | 4 ES↔CO | comp | ES | MAD-BOG | mid-bot | gen | ✓ | — |
| P-026 | 4 ES↔CO | dec | ES | MAD-BOG | bot | lei | ✓ | ✓ |
| P-027 | 4 ES↔CO | comp | ES | MAD-BOG | mid-bot | lei | ✓ | — |
| P-028 | 5 CO↔ES/EU | dec | CO | BOG-MAD | mid-bot | gen | ✓ | ✓ |
| P-029 | 5 CO↔ES/EU | dec | CO | MDE-MAD | mid-bot | lei | ✓ | ✓ |
| P-030 | 5 CO↔ES/EU | price | CO | BOG-MAD | bot | gen | ✓ | — |
| P-031 | 5 CO↔ES/EU | disc | CO | BOG-EU | mid | lei | ✓ | ✓ |
| P-032 | 5 CO↔ES/EU | dec | CO | BOG-MAD | bot | ff | ✓ | ✓ |
| P-033 | 6 EU/Intl. | comp | ES | MAD-LHR | mid-bot | gen | ✓ | ✓ |
| P-034 | 6 EU/Intl. | comp | ES | MAD-CDG | mid-bot | lei | ✓ | ✓ |
| P-035 | 6 EU/Intl. | dec | ES | MAD-MIA | mid-bot | lei | ✓ | — |
| P-036 | 6 EU/Intl. | comp | ES | MAD-IST | mid-bot | lei | ✓ | ✓ |
| P-037 | 6 EU/Intl. | comp | ES | MAD-MUC | mid-bot | biz | ✓ | — |
| P-038 | 6 EU/Intl. | comp | ES | MAD-LIS | mid-bot | biz | ✓ | ✓ |
| P-039 | 7 Precio | price | ES | MAD-TFN | bot | gen | ✓ | — |
| P-040 | 7 Precio | price | ES | MAD-BOG | bot | lei | ✓ | ✓ |
| P-041 | 7 Precio | price | ES | MAD-BOG | bot | gen | ✓ | — |
| P-042 | 7 Precio | price | CO | BOG-MAD | bot | gen | ✓ | — |
| P-043 | 7 Precio | dec | ES | MAD-BOG | bot | gen | ✓ | — |
| P-044 | 8 Equipaje | dec | CO | BOG-MAD | bot | gen | ✓ | ✓ |
| P-045 | 8 Equipaje | act | ES | MAD-BOG | bot | gen | ✓ | — |
| P-046 | 8 Equipaje | trust | ES | MAD | mid | gen | ✓ | — |
| P-047 | 9 Familias | dec | ES | MAD-BOG | bot | fam | ✓ | ✓ |
| P-048 | 9 Familias | act | CO | BOG-MAD | bot | fam | ✓ | ✓ |
| P-049 | 10 Confianza | trust | ES | MAD-BOG | mid | gen | ✓ | — |
| P-050 | 10 Confianza | act | ES | MAD-BOG | bot | gen | ✓ | ✓ |

---

## 1. Descubrimiento general (top funnel)

**P-001.** ¿Qué aerolíneas recomiendas para volar desde España?

**P-002.** Vuelo desde Madrid y no quiero elegir solo por precio, ¿qué aerolíneas debería mirar?

**P-003.** ¿Qué aerolíneas españolas tienen buena reputación y muchas rutas internacionales?

**P-004.** Para salir desde Madrid, ¿qué aerolíneas merece la pena comparar?

**P-005.** ¿En qué se diferencian las principales compañías aéreas que operan en España?

**P-006.** Para viajar de Colombia a Europa, ¿qué aerolíneas dan más confianza?

## 2. Rutas domésticas España (mid-bottom funnel)

**P-007.** Madrid-Tenerife con maleta facturada, ¿qué aerolínea conviene más?

**P-008.** Madrid-Mallorca con equipaje, ¿qué compañías vuelan y cuál suele salir mejor?

**P-009.** Madrid-Málaga con buenos horarios y maleta incluida, ¿qué aerolínea elegir?

**P-010.** Bilbao-Madrid por trabajo, ¿qué aerolínea va mejor por frecuencia y puntualidad?

**P-011.** Madrid-Las Palmas, ¿qué aerolínea ofrece mejor equilibrio entre precio y comodidad?

**P-012.** Barcelona-Mallorca sin sorpresas con el equipaje, ¿qué opciones hay?

**P-013.** Madrid-Ibiza para una escapada, ¿qué aerolínea suele ser más cómoda?

**P-014.** Madrid-Vigo o Madrid-A Coruña, ¿qué compañía tiene mejores horarios y servicio?

## 3. Rutas domésticas Colombia (mid-bottom funnel)

**P-015.** Bogotá-Cartagena con equipaje incluido, ¿qué aerolínea conviene más?

**P-016.** Medellín-Bogotá por trabajo, ¿qué aerolínea elegir por horarios y precio?

**P-017.** Bogotá-San Andrés, ¿qué aerolínea suele equilibrar mejor precio y servicio?

## 4. España ↔ Colombia (mid-bottom funnel)

**P-018.** Madrid-Bogotá, ¿qué aerolínea elegir si busco buen servicio y precio razonable?

**P-019.** Madrid-Cartagena, ¿qué aerolíneas conectan mejor con el Caribe colombiano?

**P-020.** Vuelo directo Madrid-Bogotá, ¿cuánto dura y qué aerolíneas lo operan?

**P-021.** España-Medellín, ¿qué aerolíneas llegan al José María Córdova y cuál conviene más?

**P-022.** Barcelona-Bogotá, ¿qué opciones hay y qué cambia frente a salir desde Madrid?

**P-023.** España-Cali, ¿hay vuelo directo o normalmente hay que conectar en Bogotá?

**P-024.** España-Colombia con varias ciudades, ¿qué aerolíneas permiten combinar Bogotá, Medellín o Cartagena?

**P-025.** Madrid-Bogotá, ¿qué aerolínea tiene más horarios útiles y frecuencias?

**P-026.** Turismo por Colombia desde España, ¿qué aerolínea conviene si quiero añadir vuelos internos?

**P-027.** Madrid-Bogotá en turista, ¿qué diferencias se notan entre aerolíneas?

## 5. Colombia ↔ España / Europa (mid-bottom funnel)

**P-028.** Bogotá-Madrid, ¿qué aerolínea ofrece mejor balance entre precio y servicio?

**P-029.** Medellín-Madrid sin escalas largas, ¿qué aerolíneas debería revisar?

**P-030.** Bogotá-Madrid, ¿cuándo suele convenir comprar para encontrar buen precio?

**P-031.** Desde Colombia a Europa, ¿qué aerolíneas conectan bien con París, Londres o Roma?

**P-032.** Bogotá-Madrid frecuente, ¿qué aerolínea conviene más por millas y rutas?

## 6. Europa e internacional desde España (mid-bottom funnel)

**P-033.** Madrid-Londres, ¿qué aerolíneas ofrecen servicio completo y equipaje incluido?

**P-034.** Madrid-París, ¿qué compañías son cómodas y qué precio suele verse?

**P-035.** Madrid-Miami, ¿cuál es la opción más práctica sin escalas largas?

**P-036.** Madrid-Estambul, ¿qué aerolíneas vuelan y cuánto tarda el viaje?

**P-037.** Madrid-Múnich o Madrid-Fráncfort, ¿qué aerolíneas tienen buena frecuencia y precio razonable?

**P-038.** Madrid-Lisboa o Madrid-Bruselas frecuente, ¿qué aerolínea conviene por horarios y flexibilidad?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** Madrid-Tenerife, ¿cuándo comprar para encontrar buen precio?

**P-040.** Madrid-Bogotá ida y vuelta, ¿hay opciones con buen precio, servicio y equipaje incluido?

**P-041.** España-Colombia, ¿cuándo reservar para no pagar de más?

**P-042.** Colombia-Madrid, ¿con cuánta antelación comprar para conseguir mejor precio?

**P-043.** España-Colombia, ¿qué aerolíneas suelen incluir maleta facturada?

## 8. Equipaje y políticas (bottom funnel)

**P-044.** Bogotá-Madrid con mucho equipaje, ¿qué aerolínea da mejores condiciones de maleta?

**P-045.** España-Colombia, ¿qué aerolínea suele ser más flexible para cambiar fecha?

**P-046.** Maleta perdida en vuelo internacional desde Madrid, ¿qué aerolíneas gestionan mejor la incidencia?

## 9. Familias y menores (bottom funnel)

**P-047.** Madrid-Bogotá con niños pequeños, ¿qué aerolínea facilita asientos juntos y carrito?

**P-048.** Menor no acompañado Bogotá-Madrid, ¿qué aerolínea conviene y qué documentos piden?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** Vuelos España-Colombia, ¿qué aerolínea española suele ser más puntual?

**P-050.** Cancelación de vuelo España-Colombia, ¿qué derechos tengo y qué aerolíneas responden mejor?

---

## Notas de uso para análisis longitudinal

- Usar `v7` como set principal si se busca un equilibrio entre lenguaje natural y consistencia analítica.
- Comparar contra `v5` para medir si reducir longitud mantiene o mejora la calidad de recomendación del LLM.
- Comparar contra `v6` para medir si añadir forma de pregunta aumenta riqueza de respuesta sin perder precisión.
- Mantener IDs y metadatos permite analizar SOV, posición, sentimiento y consistencia por prompt sin rehacer segmentación.
- Esta versión evita tanto el tono demasiado formal de `v2` como la búsqueda demasiado telegráfica de `v6`.
