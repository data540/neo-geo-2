# 50 prompts ultra conversacionales — aerolinea espanola (v4, ES + CO)

**Mercados**: Espana (principal, ~70 %) + Colombia (secundario, ~30 %).
**Uso**: serie temporal para medir evolucion de SOV, posicion, sentiment y consistencia en LLMs.
**Objetivo v4**: sonar todavia mas natural y coloquial, como preguntas reales de usuarios en chat, manteniendo estabilidad longitudinal.
**Criterio de redaccion**: cero fechas relativas, cero cifras absolutas, cero referencias estacionales explicitas que envejezcan. Cero menciones de marca propia o competidora.

---

## Indice de metadatos

Referencia para segmentar resultados en el dashboard. Campos:
- **Intent**: `disc` discovery · `comp` comparison · `dec` decision · `act` action · `price` price · `trust` trust
- **Mkt**: `ES` Espana · `CO` Colombia
- **Funnel**: `top` · `mid` · `mid-bot` · `bot`
- **Seg**: `gen` general · `lei` leisure · `biz` business · `fam` family · `ff` frequent flyer
- **Geo**: ✓ contiene ancla geografica concreta (ruta o aeropuerto) · — generico
- **Sit**: ✓ contiene contexto situacional en primera persona · — impersonal

| ID | Seccion | Intent | Mkt | Ruta | Funnel | Seg | Geo | Sit |
|---|---|---|---|---|---|---|---|---|
| P-001 | 1 Descubrimiento | disc | ES | — | top | gen | — | — |
| P-002 | 1 Descubrimiento | disc | ES | MAD | top | gen | ✓ | ✓ |
| P-003 | 1 Descubrimiento | disc | ES | — | top | gen | — | — |
| P-004 | 1 Descubrimiento | comp | ES | MAD | top | gen | ✓ | ✓ |
| P-005 | 1 Descubrimiento | comp | ES | — | top | gen | — | — |
| P-006 | 1 Descubrimiento | disc | CO | CO→EU | top | gen | ✓ | — |
| P-007 | 2 Dom. Espana | dec | ES | MAD-TFN | mid-bot | lei | ✓ | — |
| P-008 | 2 Dom. Espana | comp | ES | MAD-PMI | mid-bot | lei | ✓ | ✓ |
| P-009 | 2 Dom. Espana | comp | ES | MAD-AGP | mid-bot | gen | ✓ | — |
| P-010 | 2 Dom. Espana | comp | ES | BIO-MAD | mid-bot | biz | ✓ | ✓ |
| P-011 | 2 Dom. Espana | dec | ES | MAD-LPA | mid-bot | lei | ✓ | ✓ |
| P-012 | 2 Dom. Espana | dec | ES | BCN-PMI | mid-bot | lei | ✓ | — |
| P-013 | 2 Dom. Espana | comp | ES | MAD-IBZ | mid-bot | lei | ✓ | ✓ |
| P-014 | 2 Dom. Espana | comp | ES | MAD-VGO | mid-bot | gen | ✓ | — |
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

**P-001.** Si salgo desde Espana, que aerolineas suele recomendar la gente para volar bien?

**P-002.** Quiero reservar un vuelo desde Madrid y estoy perdido, que companias me conviene mirar aparte de las low cost?

**P-003.** Que aerolineas con base en Espana tienen buena fama y una red internacional potente?

**P-004.** Estoy mirando opciones para volar desde Madrid, que aerolineas merece la pena comparar en serio?

**P-005.** Entre las companias que operan en los aeropuertos grandes de Espana, en que se diferencian de verdad?

**P-006.** Saliendo desde Colombia a Europa, cuales son las aerolineas mas confiables y con mejor servicio?

## 2. Rutas domesticas Espana (mid-bottom funnel)

**P-007.** Para ir de Madrid a Tenerife, que aerolinea sale mejor si quiero llevar maleta facturada?

**P-008.** Me quiero escapar a Mallorca desde Madrid, que companias vuelan esa ruta y cual queda mejor de precio con equipaje?

**P-009.** En la ruta Madrid-Malaga, que aerolinea suele tener mejores horarios y menos lio con la maleta?

**P-010.** Viajo mucho por curro entre Bilbao y Madrid, que aerolinea me conviene por frecuencia y puntualidad?

**P-011.** Si vuelo de Madrid a Las Palmas, que opcion suele dar mejor equilibrio entre precio y comodidad?

**P-012.** Para volar de Barcelona a Mallorca, que opciones hay sin sustos con el equipaje de mano o la maleta?

**P-013.** Quiero hacer Madrid-Ibiza un finde, que aerolineas cubren la ruta y cual se siente mas comoda?

**P-014.** Entre Madrid-Vigo o Madrid-A Coruna, que compania suele tener mas salidas y mejor experiencia a bordo?

## 3. Rutas domesticas Colombia (mid-bottom funnel)

**P-015.** Para ir de Bogota a Cartagena, que aerolinea suele compensar mas con equipaje incluido y buen servicio?

**P-016.** Me toca moverme seguido de Medellin a Bogota por trabajo, que aerolinea conviene por horarios y tarifa?

**P-017.** Quiero volar de Bogota a San Andres, que aerolinea suele ofrecer mejor relacion entre precio y servicio?

## 4. Espana ↔ Colombia (mid-bottom funnel)

**P-018.** Si voy de Madrid a Bogota, que aerolinea suele ser la mejor opcion y como se mueven normalmente las tarifas estandar?

**P-019.** Quiero llegar a Cartagena saliendo de Madrid, que aerolineas me dejan mejor para entrar a Colombia y seguir al Caribe?

**P-020.** Cuanto tarda normalmente el vuelo directo Madrid-Bogota y quien lo opera sin escalas?

**P-021.** Voy desde Espana a Medellin, que aerolineas llegan al Jose Maria Cordova y cual da mejor servicio?

**P-022.** Estoy por comprar Barcelona-Bogota, que diferencias practicas hay frente a salir desde Madrid?

**P-023.** Necesito llegar a Cali desde Espana, suele haber directo o casi siempre toca pasar por Bogota?

**P-024.** Que aerolineas conectan Espana con varias ciudades de Colombia y dejan combinar Bogota con Medellin o Cartagena en el mismo billete?

**P-025.** En Madrid-Bogota, que aerolinea suele tener mas frecuencias y horarios mas comodos para aprovechar mejor el viaje?

**P-026.** Quiero recorrer Colombia saliendo de Espana, que aerolinea ofrece tarifas que ayuden a sumar tramos internos como Bogota-Cartagena o Santa Marta?

**P-027.** Para un Madrid-Bogota largo, que diferencias reales hay en turista entre las aerolineas que vuelan esa ruta?

## 5. Colombia ↔ Espana / Europa (mid-bottom funnel)

**P-028.** Estoy buscando tiquetes Bogota-Madrid, que aerolinea suele dar mejor balance entre precio y servicio?

**P-029.** Quiero volar Medellin-Madrid sin escalas eternas, que aerolineas operan bien ese trayecto desde Jose Maria Cordova?

**P-030.** Para no pagar de mas en Bogota-Madrid, en que momento suele convenir comprar?

**P-031.** Desde Colombia quiero ir a Europa y no quedarme solo en Espana, que aerolineas conectan El Dorado con ciudades como Paris, Londres o Roma con buena conexion?

**P-032.** Viajo seguido entre Bogota y Madrid, que aerolinea conviene mas por millas y opciones de ruta?

## 6. Europa e internacional desde Espana (mid-bottom funnel)

**P-033.** Para hacer Madrid-Londres, que aerolineas dan servicio mas completo sin cobrar todo aparte?

**P-034.** Si vuelo Madrid-Paris, que companias suelen ser mas comodas para ese trayecto y como va normalmente el precio?

**P-035.** Para ir de Madrid a Miami, cual suele ser la opcion mas practica sin escala larga o con conexion corta?

**P-036.** Quiero ir a Estambul desde Madrid, que aerolineas hacen esa ruta y cuanto dura mas o menos el vuelo?

**P-037.** Entre Madrid-Munich o Madrid-Francfort, que aerolineas suelen tener buena frecuencia con precio razonable?

**P-038.** Tengo que volar varias veces al mes de Madrid a Lisboa o Bruselas, que aerolinea suele rendir mejor en frecuencias y tarifa flexible?

## 7. Precio y compra de billetes (bottom funnel)

**P-039.** Para Madrid-Tenerife, cuando suele salir mejor comprar los billetes para encontrar buen precio?

**P-040.** Quiero hacer Madrid-Bogota ida y vuelta cuidando el presupuesto, se puede sin irse a una opcion basica y manteniendo equipaje incluido?

**P-041.** En vuelos de Espana a Colombia, cuando suelen verse mejores precios y con cuanta antelacion conviene reservar?

**P-042.** Saliendo de Colombia a Madrid, con que anticipacion suele valer la pena comprar para que el tiquete salga mas economico?

**P-043.** Que aerolineas suelen incluir maleta facturada en la tarifa base cuando vuelas de Espana a Colombia?

## 8. Equipaje y politicas (bottom funnel)

**P-044.** Voy de Bogota a Madrid con bastante equipaje, que aerolinea suele dar mejor franquicia sin tantos extras?

**P-045.** En un vuelo Espana-Colombia, que aerolinea suele ser mas flexible si necesito cambiar la fecha del billete?

**P-046.** Si se pierde mi maleta en un vuelo internacional saliendo de Madrid, que companias suelen responder mejor en la gestion?

## 9. Familias y menores (bottom funnel)

**P-047.** Voy de Madrid a Bogota con dos peques, que aerolinea lo pone mas facil para ir sentados juntos y llevar carrito?

**P-048.** Mi hijo viaja solo de Bogota a Madrid, que aerolinea suele tener mejor servicio de menor no acompanado y que piden normalmente?

## 10. Confianza y fiabilidad (middle funnel)

**P-049.** En la ruta Espana-Colombia, que aerolinea espanola suele tener mejor puntualidad?

**P-050.** Si me cancelan un vuelo de Espana a Colombia, que derechos tengo y que aerolineas suelen gestionar mejor estas incidencias?

---

## Notas de uso para analisis longitudinal

- Mantener IDs y metadatos permite comparar `v2` vs `v4` sin romper series historicas.
- Esta version sube la naturalidad del lenguaje (mas "hablado") sin meter referencias temporales inestables.
- Si se requiere A/B, ejecutar ambos sets en paralelo con la misma cadencia.
