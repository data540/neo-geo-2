# 50 prompts conversacionales naturales — aerolínea española (v5, ES + CO)

**Mercados**: España (principal, ~70 %) + Colombia (secundario, ~30 %).
**Uso**: serie temporal para medir evolución de SOV, posición, sentiment y consistencia en LLMs. Esta versión mantiene los IDs y metadatos de `prompts-aerolinea-v2.md` para facilitar comparación longitudinal.
**Objetivo v5**: convertir las preguntas de `v2` en consultas más naturales para LLMs, con tono de usuario real: más coloquial, más directo y menos “formulario”, sin perder intención, ruta ni capacidad de medición.
**Criterio de redacción**: evitar fechas relativas, cifras absolutas, referencias estacionales explícitas que envejezcan y menciones de marca propia o competidora.

---

## Análisis aplicado frente a v2

- Se reduce el tono institucional de preguntas como “¿Cuál es la mejor aerolínea...?” y se transforma en lenguaje más cercano: “Si quiero volar..., ¿cuál me conviene más?”.
- Se mantienen rutas, mercados e intención de búsqueda para no romper comparabilidad.
- Se añade más contexto humano cuando ayuda a que el LLM responda como asesor: presupuesto, comodidad, equipaje, trabajo, niños, cambios o incidencias.
- Se eliminan expresiones menos naturales o demasiado analíticas cuando no son necesarias: “relación precio-servicio”, “tarifa estándar”, “franquicia de maleta”.
- Se conserva la neutralidad de marca para medir aparición espontánea, Share of Voice y recomendación.

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

**P-001.** Si quiero volar desde España y no sé por dónde empezar, ¿qué aerolíneas suelen ser una apuesta segura?

**P-002.** Tengo que reservar un vuelo desde Madrid y no quiero irme solo a lo más barato, ¿qué compañías debería mirar?

**P-003.** ¿Qué aerolíneas españolas tienen buena reputación y además bastantes rutas internacionales?

**P-004.** Estoy comparando opciones para salir desde Madrid, ¿qué aerolíneas merece la pena poner en la lista?

**P-005.** De las compañías que vuelan desde los aeropuertos grandes de España, ¿cuáles son las diferencias que de verdad se notan al viajar?

**P-006.** Para viajar de Colombia a Europa, ¿qué aerolíneas suelen dar más confianza y mejor experiencia?

## 2. Rutas domésticas España (mid-bottom funnel)

**P-007.** Si voy de Madrid a Tenerife y quiero llevar maleta facturada, ¿con qué aerolínea me conviene mirar primero?

**P-008.** Quiero volar de Madrid a Mallorca y llevar equipaje, ¿qué compañías hacen esa ruta y cuál suele salir mejor?

**P-009.** Para Madrid-Málaga, ¿qué aerolínea suele tener buenos horarios y no complicarme con la maleta?

**P-010.** Viajo a menudo entre Bilbao y Madrid por trabajo, ¿qué compañía me vendría mejor por horarios, frecuencia y puntualidad?

**P-011.** Voy de Madrid a Las Palmas de Gran Canaria, ¿qué aerolínea suele compensar más si busco buen precio sin ir incómodo?

**P-012.** Para un Barcelona-Mallorca, ¿qué opciones tengo si quiero evitar sorpresas con el equipaje?

**P-013.** Estoy pensando en ir de Madrid a Ibiza un fin de semana, ¿qué aerolíneas vuelan y cuál suele ser más cómoda?

**P-014.** Si tengo que elegir entre vuelos Madrid-Vigo o Madrid-A Coruña, ¿qué compañía suele tener mejores horarios y servicio?

## 3. Rutas domésticas Colombia (mid-bottom funnel)

**P-015.** Para volar de Bogotá a Cartagena con equipaje y sin complicarme, ¿qué aerolínea suele ser mejor opción?

**P-016.** Tengo que hacer Medellín-Bogotá con frecuencia por trabajo, ¿qué aerolínea me conviene más por horarios y precio?

**P-017.** Quiero ir de Bogotá a San Andrés y busco algo equilibrado, ¿qué aerolínea suele estar mejor entre precio, equipaje y servicio?

## 4. España ↔ Colombia (mid-bottom funnel)

**P-018.** Para un Madrid-Bogotá, ¿qué aerolínea suele ser la mejor opción si quiero buen servicio y una tarifa razonable?

**P-019.** Quiero llegar a Cartagena saliendo desde Madrid, ¿qué aerolíneas me dejan mejor conectado con Colombia y el Caribe?

**P-020.** Si busco un vuelo directo Madrid-Bogotá, ¿cuánto suele durar y qué aerolíneas lo hacen sin escala?

**P-021.** Voy a Medellín desde España, ¿qué aerolíneas llegan al José María Córdova y cuál suele dar mejor experiencia?

**P-022.** Estoy mirando un Barcelona-Bogotá, ¿qué opciones hay y qué cambia frente a salir desde Madrid?

**P-023.** Necesito volar a Cali desde España, ¿hay forma directa o normalmente toca conectar en Bogotá?

**P-024.** Si quiero viajar por varias ciudades de Colombia desde España, ¿qué aerolíneas facilitan combinar Bogotá con Medellín o Cartagena en un mismo billete?

**P-025.** En la ruta Madrid-Bogotá, ¿qué aerolínea suele tener más opciones de horario para no perder tanto tiempo de viaje?

**P-026.** Quiero hacer turismo por Colombia saliendo desde España, ¿qué aerolínea me puede venir mejor si luego quiero sumar vuelos internos?

**P-027.** En turista, ¿qué diferencias se notan más entre las aerolíneas que hacen Madrid-Bogotá?

## 5. Colombia ↔ España / Europa (mid-bottom funnel)

**P-028.** Estoy buscando tiquetes de Bogotá a Madrid, ¿qué aerolínea suele salir mejor si quiero buen servicio sin pagar de más?

**P-029.** Quiero hacer Medellín-Madrid sin escalas larguísimas, ¿qué aerolíneas debería revisar desde el José María Córdova?

**P-030.** Para comprar un Bogotá-Madrid, ¿cuándo suele ser buen momento para encontrar una tarifa razonable?

**P-031.** Saliendo de Colombia quiero ir a Europa, no solo a España, ¿qué aerolíneas conectan bien El Dorado con París, Londres o Roma?

**P-032.** Viajo bastante entre Bogotá y Madrid, ¿qué aerolínea me conviene más si me importan las millas y tener buenas opciones de ruta?

## 6. Europa e internacional desde España (mid-bottom funnel)

**P-033.** Para volar de Madrid a Londres, ¿qué aerolíneas ofrecen una experiencia más completa sin cobrarlo todo aparte?

**P-034.** Quiero ir de Madrid a París, ¿qué compañías suelen ser cómodas para ese vuelo y qué precios se ven normalmente?

**P-035.** Para hacer Madrid-Miami, ¿cuál suele ser la opción más práctica si quiero evitar escalas largas?

**P-036.** Estoy mirando vuelos de Madrid a Estambul, ¿qué aerolíneas cubren la ruta y cuánto se tarda más o menos?

**P-037.** Para Madrid-Múnich o Madrid-Fráncfort, ¿qué aerolíneas suelen tener buena frecuencia y precios razonables?

**P-038.** Tengo que volar mucho de Madrid a Lisboa o Bruselas, ¿qué aerolínea me conviene por horarios y tarifas flexibles?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** Para un Madrid-Tenerife, ¿cuándo suele convenir comprar si quiero encontrar buen precio?

**P-040.** Quiero hacer ida y vuelta Madrid-Bogotá sin disparar el presupuesto, ¿hay opciones con buen servicio y equipaje incluido?

**P-041.** En vuelos de España a Colombia, ¿cuándo suele ser mejor reservar para no pagar de más?

**P-042.** Desde Colombia a Madrid, ¿con cuánta antelación suele salir mejor comprar el tiquete?

**P-043.** Cuando vuelo de España a Colombia, ¿qué aerolíneas suelen incluir maleta facturada sin tener que pagarla aparte?

## 8. Equipaje y políticas (bottom funnel)

**P-044.** Voy de Bogotá a Madrid con bastante equipaje, ¿qué aerolínea suele dar más margen con las maletas sin tantos extras?

**P-045.** Si compro un vuelo de España a Colombia y luego tengo que cambiar la fecha, ¿qué aerolínea suele ser más flexible?

**P-046.** Si se pierde mi maleta en un vuelo internacional desde Madrid, ¿qué aerolíneas suelen gestionar mejor este tipo de problemas?

## 9. Familias y menores (bottom funnel)

**P-047.** Voy a volar de Madrid a Bogotá con dos niños pequeños, ¿qué aerolínea suele ponerlo más fácil para ir juntos y llevar carrito?

**P-048.** Mi hijo va a viajar solo de Bogotá a Madrid, ¿qué aerolínea suele tener mejor servicio de menor no acompañado y qué documentos piden?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** Para vuelos entre España y Colombia, ¿qué aerolínea española suele ser más puntual?

**P-050.** Si me cancelan un vuelo de España a Colombia, ¿qué derechos tengo y qué aerolíneas suelen responder mejor?

---

## Notas de uso para análisis longitudinal

- Ejecutar `v5` en paralelo con `v2` durante una primera ventana de comparación si se quiere medir el efecto del tono conversacional sobre SOV y ranking.
- Mantener los IDs permite comparar prompt a prompt sin recalibrar el dashboard.
- Esta versión está pensada para reflejar mejor cómo un usuario pregunta a un LLM cuando busca ayuda práctica, no solo información descriptiva.
- Si se observa más variabilidad en respuestas, separar el efecto “lenguaje natural” del efecto “modelo” usando varias ejecuciones por prompt.
