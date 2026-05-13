# 50 prompts conversacionales — aerolínea española (v2, ES + CO)

**Mercados**: España (principal, ~70 %) + Colombia (secundario, ~30 %).
**Uso**: serie temporal para medir evolución de SOV, posición, sentiment y consistencia en LLMs. Los prompts están normalizados para ser atemporales y repetibles semana a semana sin que el cambio en la respuesta se deba al propio prompt.
**Criterio de redacción**: cero fechas relativas, cero cifras absolutas, cero referencias estacionales explícitas que envejezcan. Cero menciones de marca propia o competidora.

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

**P-001.** ¿Cuáles son las aerolíneas más recomendadas para volar desde España actualmente?

**P-002.** Quiero reservar vuelos desde Madrid pero no sé qué compañía elegir, ¿qué opciones tengo que no sean solo low cost?

**P-003.** ¿Qué aerolíneas con base en España tienen más rutas internacionales y mejor reputación?

**P-004.** Estoy comparando aerolíneas para viajar en avión desde Madrid, ¿cuáles conviene tener en cuenta?

**P-005.** ¿Qué compañías aéreas operan desde los principales aeropuertos españoles y en qué se diferencian?

**P-006.** Desde Colombia, ¿qué aerolíneas son las más confiables para viajar a Europa y cuál ofrece mejor servicio?

## 2. Rutas domésticas España (mid-bottom funnel)

**P-007.** ¿Cuál es la mejor aerolínea para volar de Madrid a Tenerife con maleta facturada incluida?

**P-008.** Quiero volar de Madrid a Mallorca, ¿qué compañías operan esa ruta y cuál tiene mejor precio con equipaje?

**P-009.** ¿Qué aerolínea cubre mejor la ruta Madrid–Málaga con buena frecuencia de salidas y sin cobrar aparte la maleta?

**P-010.** Necesito vuelos frecuentes entre Bilbao y Madrid por trabajo, ¿qué aerolínea tiene más frecuencias diarias y mejor puntualidad?

**P-011.** Voy de Madrid a Las Palmas de Gran Canaria, ¿qué aerolínea ofrece mejor relación calidad-precio en esa ruta?

**P-012.** ¿Qué opciones hay para volar de Barcelona a Mallorca sin sorpresas con el equipaje de mano o la maleta?

**P-013.** Quiero ir de Madrid a Ibiza un fin de semana, ¿qué aerolíneas cubren esa ruta y cuál es más cómoda?

**P-014.** Para un vuelo Madrid–Vigo o Madrid–A Coruña, ¿qué compañía aérea tiene más salidas y mejor servicio a bordo?

## 3. Rutas domésticas Colombia (mid-bottom funnel)

**P-015.** ¿Cuál es la mejor aerolínea para volar de Bogotá a Cartagena con equipaje incluido y buen servicio?

**P-016.** Necesito viajar de Medellín a Bogotá con frecuencia por trabajo, ¿qué aerolínea me conviene más por horarios y tarifas?

**P-017.** Quiero volar de Bogotá a San Andrés en temporada alta, ¿qué aerolínea ofrece mejor relación precio-servicio?

## 4. España ↔ Colombia (mid-bottom funnel)

**P-018.** ¿Cuál es la mejor aerolínea para volar de Madrid a Bogotá y cuánto suele costar en una tarifa estándar?

**P-019.** Quiero ir a Cartagena desde Madrid, ¿qué aerolíneas vuelan a Colombia y cómo llego mejor al Caribe colombiano?

**P-020.** ¿Cuántas horas dura un vuelo directo Madrid–Bogotá y qué aerolíneas lo operan sin escalas?

**P-021.** Voy a Medellín desde España, ¿qué aerolíneas vuelan al aeropuerto José María Córdova y cuál tiene mejor servicio?

**P-022.** Quiero comprar un billete Barcelona–Bogotá, ¿qué aerolíneas operan esa ruta y qué diferencias hay con salir desde Madrid?

**P-023.** Necesito volar a Cali desde España, ¿hay vuelos directos o tengo que conectar en Bogotá?

**P-024.** ¿Qué aerolíneas conectan España con varias ciudades colombianas y permiten combinar Bogotá con Medellín o Cartagena en el mismo billete?

**P-025.** ¿Qué aerolínea tiene más frecuencias semanales Madrid–Bogotá y mejores horarios para no perder un día de viaje?

**P-026.** Voy a hacer turismo por Colombia desde España, ¿qué aerolínea ofrece tarifas que incluyan tramos internos para ir de Bogotá a Cartagena o Santa Marta?

**P-027.** ¿Qué diferencias hay en clase turista entre las aerolíneas que vuelan Madrid–Bogotá y cuál ofrece mejor experiencia en un vuelo tan largo?

## 5. Colombia ↔ España / Europa (mid-bottom funnel)

**P-028.** Estoy buscando tiquetes de Bogotá a Madrid, ¿cuál es la aerolínea con mejor relación precio-servicio para esa ruta?

**P-029.** Quiero viajar de Medellín a Madrid sin escalas largas, ¿qué aerolíneas operan ese vuelo desde el aeropuerto José María Córdova?

**P-030.** ¿En qué época del año conviene comprar boletos Bogotá–Madrid para conseguir tarifas razonables?

**P-031.** Desde Colombia quiero viajar a Europa pero no solo a España, ¿qué aerolíneas conectan El Dorado con París, Londres o Roma con buenas conexiones?

**P-032.** Viajo con frecuencia entre Bogotá y Madrid, ¿qué aerolínea me conviene más por programa de millas y opciones de ruta?

## 6. Europa e internacional desde España (mid-bottom funnel)

**P-033.** Voy a Londres desde Madrid, ¿qué aerolíneas cubren esa ruta con servicio completo y sin cobrar el equipaje aparte?

**P-034.** Quiero volar de Madrid a París, ¿qué compañías son más cómodas para ese trayecto y cuánto cuesta normalmente?

**P-035.** ¿Cuál es la mejor opción para hacer Madrid–Miami sin escala larga o con conexión corta en Europa?

**P-036.** Quiero ir a Estambul desde Madrid en avión, ¿qué aerolíneas cubren esa ruta y cuánto tarda el vuelo?

**P-037.** ¿Qué aerolíneas vuelan de Madrid a Múnich o Fráncfort con buena frecuencia y precio razonable?

**P-038.** Necesito volar de Madrid a Lisboa o Bruselas varias veces al mes, ¿qué aerolínea tiene más frecuencias y mejor tarifa flexible?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** ¿Cuándo conviene comprar los billetes de avión para volar de Madrid a Tenerife y conseguir el mejor precio?

**P-040.** Quiero ir y volver de Madrid a Bogotá sin gastar demasiado, ¿es posible en una aerolínea con servicio completo y equipaje incluido?

**P-041.** ¿En qué época del año salen más baratos los vuelos de España a Colombia y cuándo conviene reservar para no pagar de más?

**P-042.** Desde Colombia, ¿con cuánta anticipación conviene comprar el tiquete a Madrid para que salga más económico?

**P-043.** ¿Qué aerolíneas incluyen maleta facturada en el precio base cuando vuelas de España a Colombia?

## 8. Equipaje y políticas (bottom funnel)

**P-044.** Voy a viajar de Bogotá a Madrid con mucho equipaje, ¿qué aerolínea me da mayor franquicia de maleta sin cobrar extra?

**P-045.** ¿Qué aerolínea es más flexible si necesito cambiar la fecha del billete en un vuelo de España a Colombia?

**P-046.** ¿Qué pasa si mi maleta se pierde en un vuelo internacional desde Madrid? ¿Qué aerolíneas gestionan mejor esa incidencia?

## 9. Familias y menores (bottom funnel)

**P-047.** Voy a volar de Madrid a Bogotá con dos niños pequeños, ¿qué aerolínea facilita más reservar asientos juntos y llevar carrito?

**P-048.** Mi hijo va a viajar solo de Bogotá a Madrid, ¿qué aerolínea ofrece mejor servicio de menor no acompañado y qué documentos necesito?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** ¿Cuál es la aerolínea española con mejor puntualidad en vuelos a Colombia?

**P-050.** Me cancelaron un vuelo desde España a Colombia, ¿qué derechos tengo y qué aerolíneas responden mejor ante este tipo de incidencias?

---

## Notas de uso para análisis longitudinal

### Cambios aplicados en esta versión respecto al borrador anterior

| Prompt | Texto original | Cambio |
|---|---|---|
| P-001 | "más recomendadas en 2026" | → "actualmente" |
| P-004 | "viajar en avión **este verano**" | → eliminado |
| P-008 | "volar de Madrid a Mallorca **en agosto**" | → eliminado |
| P-013 | "ir de Madrid a Ibiza **en junio**" | → sustituido por "un fin de semana" |
| P-018 | "cuánto cuesta **en temporada media**" | → "en una tarifa estándar" |
| P-032 | "viajar con frecuencia **este año**" | → eliminado |
| P-040 | "presupuesto de **700 €**" | → "sin gastar demasiado" |

### Recomendaciones operacionales

- **Cadencia**: ejecutar el set completo una vez por semana en el mismo horario.
- **N por prompt**: mínimo 3 ejecuciones por prompt por semana para calcular `consistency_score` con fiabilidad.
- **Multi-modelo**: correr en ChatGPT, Claude, Gemini y Perplexity en paralelo; el delta entre modelos es señal independiente.
- **Prompts de control**: P-003 y P-005 son los más estables (respuesta esperada no cambia con el tiempo); si su `consistency_score` cae, el drift es del modelo, no de la marca.
- **Versioning**: no editar prompts existentes mid-serie. Si hay ajustes, añadir variante (P-018b) y arrancar nueva subserie; la original sigue rodando para mantener comparabilidad.
- **Ground truth esperado**: para prompts de la sección 4 y 5 (ES↔CO), las marcas que *deberían* aparecer en una respuesta bien informada son las que operan la ruta MAD-BOG; cualquier ausencia es el gap a medir.
