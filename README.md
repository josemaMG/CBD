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

El Dashboard incluye múltiples gráficas y exportaciones de datos (Excel/PDF) que ayudan a evaluar el rendimiento del negocio. A continuación se detalla qué representa cada una de las métricas principales estructuradas por su sección en el panel:

#### 🌍 1. Ventas y Beneficios por Región
- **Ventas Totales (Sales):** Ingreso bruto monetario total generado en la zona geográfica agrupada (mostrado en USD `$`).
- **Beneficio Total (Profit):** Ganancia o pérdida neta real obtenida en la área tras descontar costes (los números rojos indican pérdidas).

#### 🛒 2. Rendimiento por Categoría
- **Ventas Totales:** Ingresos brutos generados por cada sub-categoría de producto.
- *(En exportación Excel)* **Beneficio Total:** Ganancia neta extraída explícitamente de esa categoría de producto.
- *(En exportación Excel)* **Artículos Vendidos (Quantity):** Suma total de unidades físicas de la categoría que fueron vendidas y procesadas.

#### 📉 3. Descuento vs Beneficio
- **Descuento Aplicado (Discount %):** Rebaja media porcentual concedida sobre los precios en ese grupo de compras.
- **Beneficio Promedio (AVG Profit):** Nivel de margen de ganancia media unitaria que arroja un pedido estándar dentro de esa banda de descuento.
- *(En exportación Excel)* **Número de Pedidos (Order Count):** Cantidad de tickets de reserva independientes con dicho nivel de descuento.

#### 🚚 4. Modos de Envío
- **Frecuencia de Envío (Frequency):** Número de veces que se ha seleccionado o empleado un método de envío logístico (Ej. Standard Class, Same Day) y su porcentaje del mix total.
- *(En exportación Excel)* **Coste de Envío Promedio (AVG Shipping Cost):** Tarifa media aplicada de sobrecoste o asumida al usar esta logística.

#### 👥 5. Ingresos por Segmento
- **Total Ingresos Generados:** Lo que han facturado los diferentes perfiles (Consumer, Corporate...).
- *(En exportación Excel)* **Recuento de Clientes (Únicos):** Contador de identidades (`customer_id`) distintas en ese nicho. Esto filtra de clientes recurrentes para saber exactamente a cuántas cabezas diferentes hemos vendido.
