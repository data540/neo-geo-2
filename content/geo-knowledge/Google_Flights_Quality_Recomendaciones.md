# Guía de Calidad y Crecimiento en Google Flights
## Recomendaciones para Aerolíneas Partners

> **Fuente:** Powering Partner Growth: Quality Strategies for Google Flights — Google (documento interno)
> **Última actualización de datos de referencia:** Mayo 2025

---

## Índice

1. [El roadmap de madurez: las 5 fases](#1-el-roadmap-de-madurez-las-5-fases)
2. [Fase 1 — Set up for success: Configuración inicial](#2-fase-1--set-up-for-success-configuración-inicial)
3. [Fase 2 — Capture Demand: Captura de demanda](#3-fase-2--capture-demand-captura-de-demanda)
4. [Fase 3 — Leverage Data: Calidad del dato](#4-fase-3--leverage-data-calidad-del-dato)
5. [Fase 4 — Unlock Demand: Maximizar reservas](#5-fase-4--unlock-demand-maximizar-reservas)
6. [Fase 5 — Evaluate and Optimize: Analítica y mejora continua](#6-fase-5--evaluate-and-optimize-analítica-y-mejora-continua)
7. [Resumen de KPIs y umbrales críticos](#7-resumen-de-kpis-y-umbrales-críticos)

---

## 1. El roadmap de madurez: las 5 fases

Google Flights organiza la evolución de sus partners en un roadmap secuencial de 5 fases. Cada fase requiere haber completado los criterios de la anterior para poder activarse.

```
FASE 1            FASE 2            FASE 3            FASE 4            FASE 5
Set up for   →   Capture      →   Leverage     →   Unlock       →   Evaluate &
success          Demand           Data             Demand           Optimize
```

| Fase | Objetivo | Criterio de entrada |
|---|---|---|
| **1. Set up for success** | Presencia fundacional con visibilidad y branding correcto | — |
| **2. Capture Demand** | Experiencia de usuario fluida con enlaces precisos y profundos | Fase 1 completada |
| **3. Leverage Data** | Calidad del dato, precios precisos y tracking efectivo | Fases 1-2 completadas |
| **4. Unlock Demand** | Maximizar reservas con tarifas competitivas y top impression share | Fases 1-3 completadas |
| **5. Evaluate and Optimize** | Mejora continua con Travel Analytics Center (TAC) | Fases 1-4 completadas |

> **Nota:** Los criterios marcados con borde discontinuo en el roadmap original requieren uno o varios criterios previos implementados para poder activarse.

---

## 2. Fase 1 — Set up for success: Configuración inicial

**Objetivo:** Garantizar una presencia fundacional en Google Flights con visibilidad completa y branding correcto.

### 2.1 Contrato GFS (Google Flights Search)

**Qué es:** Formalizar el acuerdo oficial de partnership con Google Flights.

**Cómo hacerlo:** Contactar al account manager dedicado de Google Flights para formalizar el contrato GFS.

---

### 2.2 Acceso al Travel Analytics Center (TAC)

**Qué es:** Panel de control dedicado para partners de Google Flights que permite monitorizar y analizar el rendimiento.

**Cómo hacerlo:** Solicitar acceso a través del account manager para obtener datos de rendimiento y competitividad.

---

### 2.3 Cuenta de Google Ads vinculada a Google Flights

**Qué es:** Enlace entre la cuenta de Google Ads y el portal de partner de Google Flights.

**Cómo hacerlo:** Vincular la cuenta de Google Ads dentro del portal de partner de Google Flights para habilitar el tracking de rendimiento y medición.

---

### 2.4 Participación de precios al 100%

**Qué es:** Distribución de datos de precios a GFS con una discrepancia inferior al 5%, reflejando con precisión los precios de la web.

**Umbral:** Discrepancia < 5% respecto al precio en web propia.

---

### 2.5 Nombre, logo y web correctos

**Qué es:** Nombre de marca oficial, logotipo y URLs del sitio web enviados y aprobados durante el onboarding.

**Cómo hacerlo:** Enviar durante el proceso de onboarding como partner, asegurando que cumplen las directrices de Google.

---

### 2.6 Integración directa para precios

**Qué es:** Canal de distribución de datos directo para enviar de forma eficiente los datos de precio y disponibilidad más precisos directamente a Google Flights.

**Beneficio:** Precio en tiempo real, mayor calidad del dato, distribución de precios específica por país del usuario y control directo sobre el inventario (participación).

---

## 3. Fase 2 — Capture Demand: Captura de demanda

**Objetivo:** Facilitar una experiencia de usuario fluida proporcionando enlaces precisos y profundos.

### 3.1 Deep Links (enlaces profundos) ⭐ Prioridad alta

**Qué es:**
Un **deep link** es una redirección con los detalles del itinerario preseleccionados (origen, destino, fechas de salida, número de pasajeros, número de vuelo, detalles de precio, etc.) desde la página de reserva de Google Flights directamente a la página de pago o checkout del partner, lista para introducir los datos del pasajero.

**Tipos de enlace (de menor a mayor calidad):**

| Tipo | Destino de redirección | Calidad |
|---|---|---|
| **Site link** | Página de inicio (homepage) | ❌ Mínima |
| **Shallow link** | Página de búsqueda con origen, destino y fechas preseleccionados | ⚠️ Media |
| **Deep link** | Página de pago/checkout con itinerario completo preseleccionado | ✅ Óptima |

**Por qué es crítico:**
Los partners que implementaron deep links registraron un **+50% de aumento en la tasa de conversión** (Google internal data, All Carriers, 2024).

**Nota importante:** Los deep links son **requisito obligatorio** para activar los Fare Products (productos de tarifa) para aerolíneas.

**Cómo implementarlo:** Consultar la [guía para desarrolladores de Google Flights](https://developers.google.com/travel/flights) para conocer los requisitos de implementación de deep links y shallow links.

---

### 3.2 Tasa de participación ≥ 85%

**Qué es:** Métrica que mide con qué frecuencia se muestran los booking links de la aerolínea en la plataforma, como porcentaje de las impresiones globales donde estuvo presente en el itinerario seleccionado.

**Umbral objetivo:** ≥ 85% de participation rate.

**Dato de referencia:** Los partners de Google Flights alcanzan una media del **87% de participation rate** (Google internal data, Global, 4/25/2025 - 5/25/2025).

**Por qué importa:** Cuantas más veces se muestran los booking links, más oportunidades se generan de ingresos desde Google Flights. Si solo se participa con un subconjunto del inventario o rutas, se pierden numerosas búsquedas potenciales.

**Cómo mejorarla:**
- Implementar deep links (GFS los muestra con mayor frecuencia).
- Revisar reglas sobre el número de tramos en el itinerario.
- Verificar configuraciones relacionadas con selección de infant.
- Contactar al account manager o usar el formulario "Contact Us" de GFS.

---

## 4. Fase 3 — Leverage Data: Calidad del dato

**Objetivo:** Generar insights y crecimiento a través de calidad robusta del dato, precios precisos y tracking efectivo.

### 4.1 Implementar el Crawler de calidad de precios

**Qué es:** Herramienta automatizada de Google que hace comprobaciones automáticas mediante scraping del sitio web del partner. Permite obtener más volumen de comprobaciones y, por tanto, más datos de calidad accionables.

**Beneficios:**
- Identificar fácilmente problemas de enlace o discrepancias de precio en el Travel Analytics Center.
- Conocer mejor la participación y obtener más ventas.

**Cómo implementarlo:** Consultar la [guía para desarrolladores sobre Price Accuracy Crawlers](https://developers.google.com/travel/flights).

---

### 4.2 Itinerary Not Found < 4% ⭐ KPI crítico

**Qué es:** Métrica de calidad de enlaces que muestra con qué frecuencia los links **no se encuentran** en el sitio web del partner. Los errores de enlace pueden deberse a un problema en el sitio web o a que el crawler no encontró el precio.

**Umbral crítico:** Si se supera el **5% de "Itinerary not found", se corre el riesgo de que las rutas sean desactivadas**.

**Objetivo:** Mantener por debajo del **4%**.

**Cómo mejorar este KPI:**
1. Aumentar la proporción de deep links implementados.
2. Revisar el tab **"Errors and Pricing"** en el Quality dashboard de TAC para identificar los tipos de error más frecuentes.
3. Revisar el tab **"Samples & Debug"** en el Quality dashboard de TAC para ver ejemplos de enlaces que fallan.

---

### 4.3 Price Discrepancy < 8% ⭐ KPI crítico

**Qué es:** Medida de la discrepancia entre el precio mostrado en Google Flights y el precio real en la landing page del partner.

**Impacto en el usuario:** Si el usuario hace clic esperando un precio determinado y la landing page muestra un precio más alto (por comisiones ocultas o datos desactualizados), abandona la reserva, generando una experiencia frustrante y dañando la confianza.

**Umbral objetivo:** Price discrepancy < **8%**.

**Impacto en negocio:** Mostrar precios precisos puede **mejorar la tasa de conversión 3×** y generar más ventas.

**Cómo mejorar este KPI:**
- Consultar el tab **"Quality Stats"** en el Quality dashboard de TAC.
- Identificar los principales "culpables" (top culprits) de discrepancias.

---

### 4.4 Price Accuracy Tag (píxel de precisión de precios)

**Qué es:** Pixel que los partners colocan en su landing page para reportar el precio del vuelo y permitir a Google medir la precisión de precios del partner a escala.

**Para qué sirve:**
- Monitorizar la calidad de los precios en GFS a escala.
- Identificar áreas de mejora.
- Actuar sobre discrepancias de forma oportuna.

**Cómo implementarlo:** Disponible vía **gtag (global site tag)** o vía **GTM (Google Tag Manager)**.

---

### 4.5 Conversion Tracking

**Qué es:** Implementación de tracking de conversiones para medir las conversiones procedentes de clics en los links de Google Flights.

**Para qué sirve:** Conectar las dos partes del viaje del usuario y proporcionar insights sobre ingresos y oportunidades perdidas. Habilita acceso a insights granulares de rendimiento y monitorización de ingresos en los dashboards de TAC.

**Métodos de implementación (en orden de preferencia):**
1. **Google Tag Manager (GTM)** — Método preferido
2. **Global site tag (gtag.js)**

**Acción recomendada:** Contactar al Google Flights Account Manager para arrancar el proyecto en las próximas 1-2 semanas.

---

### 4.6 Integración con Live API

**Qué es:** Integración directa con la API en tiempo real de Google Flights que permite a Google consultar directamente los sistemas de la aerolínea/OTA para precios y disponibilidad en tiempo real para todos los itinerarios del usuario (origen, destino, fechas y número de pasajeros).

**Beneficios:**
- Flexibilidad total sobre el contenido distribuido.
- Los precios en tiempo real correlacionan con mayor calidad del dato.
- Distribución de precios específica por país del usuario.
- Control directo sobre el inventario y la participación.
- Los usuarios ven siempre la información más precisa y actualizada.

**Cómo implementarlo:** Consultar la [guía para desarrolladores sobre Live API integration](https://developers.google.com/travel/flights).

---

## 5. Fase 4 — Unlock Demand: Maximizar reservas

**Objetivo:** Maximizar reservas ofreciendo tarifas competitivas y asegurando el top impression share.

### 5.1 Fare Products (Productos de Tarifa)

**Qué es:** Opciones de precio que las aerolíneas pueden mostrar a los usuarios en la página de reserva de Google Flights para ofrecer tarifas de mayor valor (upsell) y recibir mayor referral value.

**Impacto en negocio:** Activar Fare Products **incrementa el valor medio del pedido en +10% de media**.

**Requisitos previos obligatorios:**
1. Tener contrato GFS firmado.
2. Tener deep links implementados.

**Cómo activarlo:** Contactar a flights-fare-products@google.com para habilitar los fare products. El proceso puede tardar hasta ~1 trimestre.

---

### 5.2 Top Impression Share > 80%

**Qué es:** Las "Top Impressions" son los primeros links visibles sin necesidad de más clics en la página de reserva (típicamente los 5 primeros). El **Top Impression Share (TIS)** es el porcentaje de veces que el link de la aerolínea aparece en esas posiciones más prominentes frente al total de veces que podría haber aparecido.

**Umbral objetivo:** Top Impression Share > **80%** en las rutas más populares.

**Por qué importa:** Los anunciantes posicionados en los primeros links tienen mayor probabilidad de conseguir clics y conversiones. Aparecer en las primeras posiciones también genera mayor confianza en el usuario.

**Cómo mejorar el TIS:**
- Ofrecer de forma consistente los precios más competitivos y precisos.
- Garantizar un feed de datos de alta calidad y en tiempo real.
- Proporcionar una experiencia de landing page/booking fluida y sin fricciones.

---

### 5.3 Not Lowest Price < 45%

**Qué es:** Google compara el precio del booking link con los de otros partners de Google Flights durante un período y los clasifica en 5 "price buckets" que van desde "Check Price" (sin información de precio) hasta "Not Lowest" (cuando la aerolínea no ofrece el precio más barato entre todas las opciones).

**Umbral objetivo:** Mantener menos del **45%** de rutas en el bucket "Not Lowest Price".

**Referencia de los top partners:** Los mejores partners de Google tienen menos del **35% de rutas en el bucket "Not Lowest Price"**, incluso con un posicionamiento premium (Google internal data, Global, 4/25/2025 - 5/25/2025).

**Por qué importa:** Los viajeros son muy sensibles al precio. Cuando ven múltiples opciones, casi invariablemente hacen clic primero en el precio más bajo.

**Cómo mejorar este KPI:**
- Ofrecer de forma consistente las tarifas más competitivas y precisas.
- Asegurarse de que el precio publicado es el más bajo disponible para ese itinerario.
- Analizar qué clases de tarifa están vendiendo los competidores y ajustar la oferta para igualarla o mejorarla, especialmente en rutas populares.

---

## 6. Fase 5 — Evaluate and Optimize: Analítica y mejora continua

**Objetivo:** Mejorar continuamente el rendimiento e identificar nuevas oportunidades usando el Travel Analytics Center.

### 6.1 TAC con integración BigQuery

**Qué es:** Integración de los datasets de Google Flights en BigQuery para acceso programático a los datos de calidad.

**Ventajas sobre los dashboards estándar de TAC:**
- **Mayor volumen de muestras:** Los dashboards están limitados a los últimos días; BigQuery contiene los últimos **90 días** de datos.
- **Acceso programático:** Permite configurar alertas propias o explorar datos con dashboards personalizados.
- **Integración con pipelines de datos existentes** (Funnel.io, Looker Studio, etc.).

**Cómo acceder:** Leer el artículo del Help Center correspondiente y solicitar acceso. Es necesario tener acceso al Google Cloud project propio previamente.

---

### 6.2 Aprovechar el Travel Analytics Center (TAC) para decisiones de negocio

**Qué es:** El TAC es el panel de control dedicado para partners de Google Flights para monitorizar y analizar el rendimiento.

**Casos de uso estratégico del TAC:**

| Caso de uso | Descripción |
|---|---|
| **Evaluar posicionamiento en el mercado** | Entender competitividad y visibilidad frente a otros carriers |
| **Identificar oportunidades de crecimiento** | Detectar rutas o segmentos con alto potencial |
| **Evaluar efectividad del producto** | Identificar problemas de UX que afectan a las conversiones |
| **Monitorizar la salud del canal** | Trackear la contribución de Google Flights a los objetivos globales de negocio |

**Dato de uso:** Los mejores partners dedican una media de **2 horas y 27 minutos por usuario al mes** en TAC (Google internal data, Global, 4/25/2025 - 5/25/2025).

**Acción recomendada:** Verificar con el account manager si se tiene acceso al TAC dedicado y solicitar las formaciones externas disponibles.

---

## 7. Resumen de KPIs y umbrales críticos

### 7.1 Tabla maestra de KPIs

| KPI | Umbral objetivo | Umbral crítico | Impacto si no se cumple | Fase |
|---|---|---|---|---|
| **Participation Rate** | ≥ 87% (media del sector) | < 85% | Pérdida de impresiones y revenue | 2 |
| **Itinerary Not Found** | < 4% | > 5% | **Desactivación de rutas** | 3 |
| **Price Discrepancy** | < 8% | > 8% | Pérdida de conversión (3×) | 3 |
| **Top Impression Share** | > 80% | < 80% | Menor CTR y confianza | 4 |
| **Not Lowest Price** | < 45% | > 45% | Pérdida de clics (viajeros eligen precio más bajo) | 4 |

### 7.2 Impacto de las optimizaciones en conversión

| Optimización | Impacto cuantificado | Fuente |
|---|---|---|
| Deep links vs. shallow/site links | **+50% en tasa de conversión** | Google internal data, All Carriers, 2024 |
| Precios precisos (price discrepancy < 8%) | **Conversión 3× mayor** | Google internal data |
| Fare Products habilitados | **+10% en valor medio de pedido** | Google internal data |
| Top Impression Share > 80% | Mayor CTR + mayor confianza del usuario | Google internal data |

### 7.3 Checklist de estado actual (auditoría inicial)

**Fase 1 — Set up for success**
- [ ] Contrato GFS firmado
- [ ] Acceso a TAC solicitado y activo
- [ ] Cuenta Google Ads vinculada a Google Flights
- [ ] Participación de precios al 100% (discrepancia < 5%)
- [ ] Nombre, logo y URL validados en el portal de partner
- [ ] Integración directa para precios implementada

**Fase 2 — Capture Demand**
- [ ] Deep links implementados (verificar con developer guide)
- [ ] Participation Rate ≥ 85%
- [ ] Revisión de tipos de error en links (tramos, infants, etc.)

**Fase 3 — Leverage Data**
- [ ] Crawler de calidad de precios implementado
- [ ] Itinerary Not Found < 4% (verificar en TAC Quality dashboard)
- [ ] Price Discrepancy < 8% (verificar en TAC Quality Stats)
- [ ] Price Accuracy Tag implementado (via gtag o GTM)
- [ ] Conversion Tracking configurado (via GTM preferentemente)
- [ ] Live API integration activa

**Fase 4 — Unlock Demand**
- [ ] Fare Products habilitados (requiere GFS contract + deep links)
- [ ] Top Impression Share > 80% en rutas principales
- [ ] Not Lowest Price < 45% (objetivo < 35% como top partner)

**Fase 5 — Evaluate and Optimize**
- [ ] BigQuery integrado con TAC para acceso a 90 días de datos
- [ ] TAC utilizado activamente para decisiones estratégicas (≥ 2h27/mes por usuario)
- [ ] Alertas propias configuradas sobre datos de calidad

---

> *Documento elaborado a partir de la presentación oficial de Google "Powering Partner Growth: Quality Strategies for Google Flights" (mayo 2025). Datos de benchmarking basados en Google Internal Data, Global, 4/25/2025–5/25/2025, salvo indicación contraria.*
