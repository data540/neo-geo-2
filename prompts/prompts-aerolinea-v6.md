# 50 prompts breves para chat IA — aerolínea española (v6, ES + CO)

**Mercados**: España (principal, ~70 %) + Colombia (secundario, ~30 %).
**Uso**: serie temporal para medir evolución de SOV, posición, sentiment y consistencia en LLMs.
**Objetivo v6**: representar cómo preguntará un usuario cuando escriba directamente en ChatGPT u otro chat de IA sobre aerolíneas. Las consultas son breves, pero no telegráficas: incluyen contexto suficiente para que el modelo pueda recomendar, comparar y explicar sin tener que adivinar demasiado.
**Criterio de redacción**: cero fechas relativas, cero cifras absolutas, cero referencias estacionales explícitas que envejezcan. Cero menciones de marca propia o competidora.

---

## Enfoque de esta versión

- Prompts breves, pero escritos como peticiones reales a ChatGPT.
- Más contexto que una búsqueda tradicional, sin llegar al tono largo y coloquial de `v5`.
- Intención clara desde el inicio: recomendar, comparar, elegir, entender precio, equipaje o fiabilidad.
- Se usan formulaciones naturales como “ayúdame a elegir”, “qué tendría que comparar” o “qué opción tiene más sentido”.
- Conserva rutas, mercados e intención de `prompts-aerolinea-v2.md` para mantener comparabilidad.
- Pensado para usuarios que ya saben que una IA entiende lenguaje natural y por eso escriben una frase completa, aunque directa.

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

**P-001.** Ayúdame a identificar qué aerolíneas suelen ser más recomendables para volar desde España.

**P-002.** Voy a reservar un vuelo desde Madrid y no quiero fijarme solo en low cost, ¿qué aerolíneas debería comparar?

**P-003.** ¿Qué aerolíneas españolas combinan buena reputación con una red internacional amplia?

**P-004.** Quiero salir desde Madrid y comparar bien antes de comprar, ¿qué aerolíneas debería tener en cuenta?

**P-005.** Explícame las diferencias principales entre las compañías que operan en los grandes aeropuertos españoles.

**P-006.** Si viajo de Colombia a Europa, ¿qué aerolíneas suelen ser más confiables y cómodas?

## 2. Rutas domésticas España (mid-bottom funnel)

**P-007.** Ayúdame a elegir aerolínea para Madrid-Tenerife si quiero llevar maleta facturada.

**P-008.** Quiero volar de Madrid a Mallorca con equipaje, ¿qué compañías debería comparar y cuál suele compensar más?

**P-009.** Para Madrid-Málaga, ¿qué aerolínea suele ir mejor si me importan los horarios y no tener líos con la maleta?

**P-010.** Viajo por trabajo entre Bilbao y Madrid, ¿qué aerolínea elegirías por frecuencia, horarios y puntualidad?

**P-011.** Para volar de Madrid a Las Palmas, ¿qué aerolínea tiene más sentido si busco precio razonable y comodidad?

**P-012.** Quiero hacer Barcelona-Mallorca sin sorpresas con el equipaje, ¿qué aerolíneas conviene mirar?

**P-013.** Para una escapada Madrid-Ibiza, ¿qué aerolíneas vuelan y cuál suele dar una experiencia más cómoda?

**P-014.** Entre Madrid-Vigo y Madrid-A Coruña, ¿qué compañía suele destacar por horarios y servicio?

## 3. Rutas domésticas Colombia (mid-bottom funnel)

**P-015.** Ayúdame a elegir aerolínea para Bogotá-Cartagena si quiero llevar equipaje incluido.

**P-016.** Viajo seguido de Medellín a Bogotá por trabajo, ¿qué aerolínea conviene más por horarios y tarifas?

**P-017.** Para Bogotá-San Andrés, ¿qué aerolínea suele ser mejor si quiero equilibrar precio, equipaje y servicio?

## 4. España ↔ Colombia (mid-bottom funnel)

**P-018.** Quiero volar Madrid-Bogotá, ¿qué aerolínea recomendarías si busco buen servicio y precio razonable?

**P-019.** Quiero ir de Madrid a Cartagena, ¿qué ruta y aerolíneas me dejarían mejor conectado con el Caribe colombiano?

**P-020.** Necesito un vuelo directo Madrid-Bogotá, ¿cuánto dura normalmente y qué aerolíneas lo operan?

**P-021.** Voy a Medellín desde España, ¿qué aerolíneas llegan al José María Córdova y cuál conviene más?

**P-022.** Estoy mirando Barcelona-Bogotá, ¿qué opciones tengo y qué diferencia hay frente a salir desde Madrid?

**P-023.** Quiero llegar a Cali desde España, ¿hay vuelo directo o normalmente tendría que conectar en Bogotá?

**P-024.** Si quiero combinar varias ciudades de Colombia desde España, ¿qué aerolíneas facilitan hacerlo en un mismo viaje?

**P-025.** En Madrid-Bogotá, ¿qué aerolínea suele tener más frecuencias y horarios que aprovechen mejor el viaje?

**P-026.** Voy a hacer turismo por Colombia desde España, ¿qué aerolínea me conviene si quiero añadir vuelos internos?

**P-027.** Para Madrid-Bogotá en turista, ¿qué diferencias reales se notan entre aerolíneas?

## 5. Colombia ↔ España / Europa (mid-bottom funnel)

**P-028.** Estoy buscando Bogotá-Madrid, ¿qué aerolínea ofrece mejor balance entre precio, servicio y comodidad?

**P-029.** Quiero volar Medellín-Madrid sin escalas largas, ¿qué aerolíneas debería revisar primero?

**P-030.** Para comprar Bogotá-Madrid, ¿cuándo suele ser buen momento para encontrar una tarifa razonable?

**P-031.** Saliendo de Colombia hacia Europa, ¿qué aerolíneas conectan bien con París, Londres o Roma?

**P-032.** Viajo seguido Bogotá-Madrid, ¿qué aerolínea me conviene más si me importan las millas y las opciones de ruta?

## 6. Europa e internacional desde España (mid-bottom funnel)

**P-033.** Para Madrid-Londres, ¿qué aerolíneas ofrecen una experiencia completa sin cobrar todo aparte?

**P-034.** Quiero volar Madrid-París, ¿qué compañías suelen ser cómodas y qué precios se ven normalmente?

**P-035.** Para Madrid-Miami, ¿qué opción recomendarías si quiero evitar escalas largas?

**P-036.** Estoy mirando Madrid-Estambul, ¿qué aerolíneas vuelan esa ruta y cuánto tarda el viaje?

**P-037.** Para Madrid-Múnich o Madrid-Fráncfort, ¿qué aerolíneas tienen buena frecuencia sin disparar el precio?

**P-038.** Vuelo a menudo de Madrid a Lisboa o Bruselas, ¿qué aerolínea conviene por horarios y flexibilidad?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** Quiero comprar Madrid-Tenerife, ¿cuándo suele convenir reservar para encontrar buen precio?

**P-040.** Quiero Madrid-Bogotá ida y vuelta sin gastar de más, pero con buen servicio y equipaje, ¿qué opciones hay?

**P-041.** En vuelos de España a Colombia, ¿cuándo suele ser mejor reservar para no pagar de más?

**P-042.** Si vuelo de Colombia a Madrid, ¿con cuánta antelación conviene comprar el tiquete?

**P-043.** En vuelos España-Colombia, ¿qué aerolíneas suelen incluir maleta facturada en la tarifa?

## 8. Equipaje y políticas (bottom funnel)

**P-044.** Viajo Bogotá-Madrid con bastante equipaje, ¿qué aerolínea ofrece mejores condiciones de maleta?

**P-045.** Si necesito cambiar la fecha de un vuelo España-Colombia, ¿qué aerolínea suele ser más flexible?

**P-046.** Si se pierde mi maleta en un vuelo internacional desde Madrid, ¿qué aerolíneas suelen gestionar mejor la incidencia?

## 9. Familias y menores (bottom funnel)

**P-047.** Voy Madrid-Bogotá con niños pequeños, ¿qué aerolínea facilita más ir juntos y llevar carrito?

**P-048.** Mi hijo viajará solo de Bogotá a Madrid, ¿qué aerolínea conviene para menor no acompañado y qué documentos piden?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** En vuelos entre España y Colombia, ¿qué aerolínea española suele ser más puntual y fiable?

**P-050.** Si me cancelan un vuelo España-Colombia, ¿qué derechos tengo y qué aerolíneas suelen responder mejor?

---

## Notas de uso para análisis longitudinal

- Ejecutar `v6` como set alternativo para medir comportamiento de consultas breves en chat IA.
- Comparar contra `v5` para separar el efecto de lenguaje conversacional largo frente a pregunta breve-natural.
- Mantener los mismos IDs permite comparar SOV, posición y sentimiento por intención sin recalibrar el dashboard.
- Esta versión evita consultas robóticas tipo keyword y da al LLM suficiente contexto para recomendar o comparar con más precisión.
