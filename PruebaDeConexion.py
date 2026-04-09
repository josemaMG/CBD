from pyhive import hive
import pandas as pd

# 1. Establecer la conexión con los datos de tu docker-compose
# Usamos localhost y el puerto 10000 mapeado en tu yml
conexion = hive.Connection(
    host='localhost', 
    port=10000, 
    username='hive' # Usuario por defecto común en estas imágenes
)

# 2. Crear un cursor para ejecutar consultas
cursor = conexion.cursor()

# 3. Ejecutar una consulta de prueba (HiveQL)
# Aquí pediríamos las bases de datos existentes
cursor.execute("SHOW DATABASES")

# 4. Leer los resultados
print("Bases de datos en tu clúster Hive:")
for base_datos in cursor.fetchall():
    print(base_datos)

# --- BONUS PARA TU APP DE REPORTES ---
# Lo ideal para reportes es usar Pandas para manejar la tabla de resultados
# query = "SELECT * FROM mis_ventas LIMIT 10"
# df_ventas = pd.read_sql(query, conexion)
# print(df_ventas.head())

# Cerrar la conexión cuando la app termine
cursor.close()
conexion.close()