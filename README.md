# Proyecto CBD - Superstore Analytics Dashboard

Este proyecto es un panel de visualización integral para análisis de grandes volúmenes de datos usando herramientas de Big Data y desarrollo Full-Stack. Cuenta con un origen de datos en Apache Hive, un Backend en Python (FastAPI) y un Frontend interactivo en React.

A continuación tienes todos los pasos detallados para arrancar el entorno en Windows desde cero:

### 1. Instalación de Docker Desktop
Apache Hive se ejecuta usando contenedores Docker. Si usas Windows, necesitas tener instalado Docker Desktop:
1. Ve a la [página oficial de Docker Desktop](https://www.docker.com/products/docker-desktop/) y descarga el instalador.
2. Ejecuta el archivo `.exe` descargado y asegúrate de que la palomita habilitando WSL 2 (Windows Subsystem for Linux) está activada durante la instalación.
3. Una vez termine, abre el programa Docker Desktop y acepta los términos. Tardará un minuto parpadear "Docker Engine starting" y quedará corriendo en segundo plano (puedes minimizar la pestaña).

### 2. Despliegue de la imagen Docker de Hive
Dentro de los binarios del proyecto (o tu descarga original) necesitas tener el archivo `docker-compose.yml` necesario para tu Hive.
1. Abre tu terminal (PowerShell o CMD).
2. Levanta el clúster ejecutando el comando:
   ```bash
   docker-compose up -d
   ```
3. Espera al menos uno o dos minutos tras crear el contenedor. Apache Hive y su MetaStore son sistemas muy pesados y tardan un par de minutos en arrancar por completo para admitir conexiones.

#### Solución del error de inicialización de Hive (importante)

Si en los logs aparece un mensaje como:

```bash
HiveServer2 running as process X. Stop it first.
```

no significa necesariamente que Hive esté roto de forma permanente. Suele ocurrir porque el contenedor fue reiniciado mientras aún estaba inicializando el esquema interno de metastore (Derby). Durante ese proceso, el script de arranque intenta levantar HiveServer2 y detecta un proceso/PID previo en curso, entrando en un arranque conflictivo.

También es normal ver advertencias de `SLF4J: Class path contains multiple bindings`; son warnings de logging y no la causa principal del fallo.

Para recuperarlo de forma limpia:

```bash
docker compose down --remove-orphans
docker rm -f mi_hive
docker compose up -d --force-recreate
docker compose logs -f hiveserver2
```

Espera a ver en logs estas trazas antes de continuar:

```bash
Initialization script completed
Initialized schema successfully..
Starting HiveServer2
```

Luego valida la conexión con:

```bash
python PruebaDeConexion.py
```

Si responde con la base `default`, Hive ya quedó operativo.

### 3. Crear Entorno Virtual e Instalar Dependencias
Para poder lanzar los scripts de Python y el Backend, necesitas primero preparar el entorno:
1. Abre tu terminal (PowerShell por defecto) en la raíz de este proyecto (la carpeta `CBD`).
2. Crea en local el entorno virtual llamado `.venv` ejecutando:
   ```bash
   python -m venv .venv
   ```
3. Actívalo en esa misma ventana del terminal:
   ```bash
   .\.venv\Scripts\activate
   ```
4. Instala todas las dependencias requeridas que están listadas en el archivo `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```

### 4. Poblar la Base de Datos (Hive)
Hemos programado un script ultra-eficiente para volcar todos tus archivos `.csv` a Hive, saltándose las temidas caídas de memoria de Tez.
1. Asegúrate de tener PowerShell abierto en la raíz del proyecto y tu entorno virtual `.venv` activado.
2. Ejecuta el vaciado (opcional) y el rellenado:
   ```bash
   python VaciarBD.py
   python RellenarBD.py
   ```
3. Verás en vivo como este script combina todos los archivos localizados en la carpeta `/data` y transfiere miles de registros rápidamente.

### 5. Iniciar el Backend (FastAPI)
Para que el Frontend y Hive puedan comunicarse fluidamente, hay que encender la API de Python.
1. En una nueva ventana de la terminal, asegúrate de llegar a la carpeta raíz del proyecto y activa tu entorno virtual de nuevo (`.\.venv\Scripts\activate`).
2. Ejecuta:
   ```bash
   python backend/main.py
   ```
3. Aparecerá un mensaje indicando que `Uvicorn running on http://0.0.0.0:8000`. No cierres esta ventana.

### 6. Iniciar el Frontend y Ver el Dashboard
Para levantar el servidor web con la interfaz gráfica de usuario en React:
1. Abre una pestaña final en el terminal y accede a la carpeta frontend:
   ```bash
   cd frontend
   ```
2. Instala por si acaso las dependencias en caché (solo la primera vez):
   ```bash
   npm install
   ```
3. Lanza el servidor web interactivo de Vite:
   ```bash
   npm run dev
   ```
4. Ingresa ahora desde tu navegador a **http://localhost:5173/**. 

## 📊 Diccionario de Métricas y KPIs

El Dashboard incluye múltiples gráficas y exportaciones de datos (Excel/PDF) que ayudan a evaluar el rendimiento del negocio. A continuación se detalla qué representa cada métrica por sección.

### Panel Principal

#### 🌍 1. Ventas Totales por Región
- **Ventas Totales (Sales):** Ingreso bruto monetario total generado en la zona geográfica agrupada (USD).
- **Beneficio Total (Profit):** Ganancia o pérdida neta obtenida en cada zona.

#### 📈 2. Beneficios según Mes y Año
- **Beneficio Total Mensual:** Suma de beneficio por combinación Año-Mes.
- **Limpieza de fecha aplicada:** Se excluyen registros con año inválido (año 0 o menor a 2000) y con mes fuera del rango 1-12.

#### 🛒 3. Rendimiento por Subcategorías
- **Ventas Totales por Subcategoría:** Ingresos brutos por subcategoría de producto.
- **Beneficio Total (en exportación):** Ganancia neta agregada por categoría/subcategoría.
- **Artículos Vendidos (Quantity):** Suma de unidades vendidas.

#### 📉 4. Descuento vs Beneficio
- **Descuento Aplicado (Discount %):** Rebaja media porcentual concedida sobre los precios.
- **Beneficio Promedio (AVG Profit):** Margen de ganancia media por nivel de descuento.
- **Normalización de tramos:** Cada punto representa un porcentaje de descuento consolidado (sin duplicados para el mismo %).
- **Tooltip contextual:** Al pasar el ratón se muestra el texto `Descuento de: [porcentaje aplicado]`.
- **Número de Pedidos (en exportación):** Cantidad de tickets en ese nivel de descuento.

#### 🚚 5. Modos de Envío
- **Frecuencia de Envío (Frequency):** Uso total de cada método logístico y su peso relativo.
- **Coste de Envío Promedio (AVG Shipping Cost):** Coste medio por modo de envío.

#### 👥 6. Ingresos por Segmento
- **Total Ingresos Generados:** Facturación total por tipo de cliente (Consumer, Corporate, Home Office).
- **Recuento de Clientes (Únicos):** Número de clientes distintos por segmento.

#### 🌐 7. Ventas de Subcategorías por Mercado
- **Ventas Totales por Subcategoría y Mercado:** Ranking de ventas según mercado seleccionado.
- **Filtro de Mercado:** Permite aislar rendimiento por cada market sin perder los filtros globales de año/mes/región.

#### 🔎 8. Mejores Categorías por Beneficio Total (Top 10)
- **Top 10 por Beneficio Total:** Muestra como mínimo los 10 mejores resultados ordenados por beneficio total.
- **Granularidad:** Ranking por categoría y subcategoría.
- **Métricas incluidas:** Ventas Totales, Cantidad y Beneficio Total.

### Insights Avanzados

#### ⚠️ 9. Fugas de Rentabilidad
- **Objetivo:** Detectar productos con ventas altas pero beneficio negativo.
- **Métricas:** Ventas Totales, Beneficio Total y Descuento Promedio.

#### ⏱️ 10. Eficiencia Logística (Time-to-Ship)
- **Días Promedio de Envío:** Tiempo medio entre pedido y envío por prioridad.
- **Coste de Envío Promedio:** Relación entre velocidad logística y coste.

#### 👑 11. Pareto de Clientes (Top 15)
- **Ventas Totales por Cliente:** Identifica clientes con mayor aportación de ingresos.
- **Segmentación visual:** Colores por tipo de segmento.

#### 📆 12. Estacionalidad de Ventas (MoM)
- **Comparativa mensual por año:** Evolución de ventas mes a mes por cada año disponible.
- **Uso recomendado:** Detectar patrones estacionales y meses críticos.

#### 🌍 13. Geoespacial de Márgenes (Riesgo por País/Mercado)
- **Margen de Beneficio (%):** Señala países/mercados con menor rentabilidad.
- **Aplicación:** Priorización de acciones comerciales y logísticas en zonas de riesgo.
