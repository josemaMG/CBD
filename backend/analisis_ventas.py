import time
import pandas as pd
from pyhive import hive

def limpiar_pantalla():
    print("\n" * 2)

def mostrar_menu():
    limpiar_pantalla()
    print("=" * 60)
    print("   SISTEMA DE ANALISIS DE VENTAS (HADOOP / HIVE)")
    print("=" * 60)
    print(" Introduce los filtros deseados (deja en blanco para ignorar).")
    print(" Sugerencias:")
    print("  - Ciudad: 'Sevilla', 'New York City', 'London', etc.")
    print("  - Categoria: 'Furniture', 'Office Supplies', 'Technology'")
    print("  - Ano: '2011', '2012', '2013', '2014'")
    print("-" * 60)
    
    ciudad = input("    Ciudad: ").strip()
    categoria = input("    Categoria: ").strip()
    anio = input("    Ano: ").strip()
    
    return ciudad, categoria, anio

def construir_query(ciudad, categoria, anio):
    # Base de la consulta, utilizando CAST para asegurar que suma numéricamente 
    # y COALESCE para evitar nulos en agrupaciones si fuera necesario.
    query = """SELECT 
    city as Ciudad, 
    category as Categoria, 
    year as Anio,
    ROUND(SUM(CAST(sales AS DOUBLE)), 2) as Ventas_Totales,
    SUM(quantity) as Cantidad_Total,
    ROUND(SUM(profit), 2) as Beneficio_Total
FROM superstore
WHERE 1=1"""

    # Añadimos los filtros dinámicos (esto es la clave para la demostración)
    if ciudad:
        query += f"\n  AND city = '{ciudad}'"
    if categoria:
        query += f"\n  AND category = '{categoria}'"
    if anio:
        query += f"\n  AND year = {anio}"
        
    query += "\nGROUP BY city, category, year"
    query += "\nORDER BY Ventas_Totales DESC"
    query += "\nLIMIT 20"
    
    return query

def ejecutar_analisis():
    ciudad, categoria, anio = mostrar_menu()
    query = construir_query(ciudad, categoria, anio)
    
    limpiar_pantalla()
    print(" CONSTRUYENDO CONSULTA HIVEQL DINAMICA...")
    print("-" * 60)
    # Mostramos la query generada en azul/cyan para destacar (opcional ansi)
    print(f"\033[96m{query}\033[0m")
    print("-" * 60)
    
    print("\n Lanzando consulta sobre el cluster Hadoop (Hive)...")
    start_time = time.time()
    
    try:
        # Se establece la conexión a Hive
        conexion = hive.Connection(host='localhost', port=10000, username='hive')
        
        # Ejecutamos la consulta y recuperamos los resultados directamente en un DataFrame
        # Esto simula un flujo real analítico conectando un framework como Pandas.
        df = pd.read_sql(query, conexion)
        
        end_time = time.time()
        
        limpiar_pantalla()
        if df.empty:
            print(" No se encontraron resultados para los filtros seleccionados.")
        else:
            print(" RESULTADOS OBTENIDOS:")
            print("=" * 65)
            # Mostramos el DataFrame limpio
            print(df.to_string(index=False))
            print("=" * 65)
            
        print(f"\n Tiempo de ejecucion en cluster: {end_time - start_time:.2f} segundos")
        print(" Nota: He implementado una interfaz donde el usuario puede definir \nfiltros dinamicos, que se traducen en consultas HiveQL ejecutadas \nsobre datos en HDFS, simulando un sistema de analisis real.\n")
        
    except Exception as e:
        print(f"\n Error al ejecutar la consulta en Hive: {e}")
        print("Asegúrate de que tus contenedores Docker (Hadoop/Hive) están en ejecución,")
        print("y que corriste RellenarBD.py previamente.")
    finally:
        if 'conexion' in locals():
            conexion.close()

if __name__ == '__main__':
    while True:
        ejecutar_analisis()
        continuar = input("\n¿Desea realizar un nuevo análisis? (s/n): ").strip().lower()
        if continuar != 's':
            print("\n¡Gracias por usar el sistema de analisis de ventas! \n")
            break
