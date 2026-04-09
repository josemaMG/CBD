import pandas as pd
from pyhive import hive
import os
import re
import subprocess

def rellenar_bd():
    data_dir = 'data'
    if not os.path.exists(data_dir):
        print(f"No se encuentra la carpeta '{data_dir}'.")
        return

    archivos = [f for f in os.listdir(data_dir) if f.endswith(('.csv', '.xls', '.xlsx'))]
    if not archivos:
        print("No hay archivos legibles (.csv, .xls, .xlsx) en la carpeta data.")
        return

    print("Leyendo y combinando todos los ficheros...")
    lista_dfs = []
    
    for archivo in archivos:
        ruta = os.path.join(data_dir, archivo)
        print(f"-> Leyendo: {archivo}")
        try:
            if archivo.endswith('.csv'):
                df_temp = pd.read_csv(ruta, encoding='utf-8', encoding_errors='replace')
            elif archivo.endswith(('.xls', '.xlsx')):
                df_temp = pd.read_excel(ruta)
                
            df_temp.columns = [re.sub(r'[^a-zA-Z0-9_]', '_', c).lower().strip('_') for c in df_temp.columns]
            
            for col in df_temp.select_dtypes(['object']).columns:
                 df_temp[col] = df_temp[col].astype(str).str.replace(r"[\t\n\r]", " ", regex=True)
            
            lista_dfs.append(df_temp)
        except Exception as e:
            print(f"Error al leer {archivo}: {e}")
            continue

    if not lista_dfs:
        print("No se pudo extraer información de ningún fichero.")
        return

    print("\nConcatenando datos...")
    df = pd.concat(lista_dfs, ignore_index=True, sort=False)
    
    if 'market' in df.columns:
        print("Ajustando mercados vacíos de forma equitativa...")
        mercados_validos = df['market'].dropna().unique()
        mercados_validos = [m for m in mercados_validos if str(m).strip() not in ('nan', 'None', '')]
        
        if mercados_validos:
            mask_vacios = df['market'].isna() | df['market'].astype(str).str.strip().isin(['nan', 'None', '', 'NaN'])
            indices_vacios = df[mask_vacios].index
            
            from itertools import cycle
            ciclo_mercados = cycle(mercados_validos)
            
            for idx in indices_vacios:
                df.at[idx, 'market'] = next(ciclo_mercados)
    
    print("Generando identificador global único para todos los registros...")
    df.insert(0, 'id_global', range(1, len(df) + 1))
    
    nombre_tabla = "superstore"

    archivo_temporal = 'volcado_temporal.tsv'
    print(f"Exportando temporalmente {len(df)} registros a formato TSV...")
    df.to_csv(archivo_temporal, sep='\t', header=False, index=False, na_rep='\\N', lineterminator='\n')

    print("\nConectando con Apache Hive...")
    try:
        conexion = hive.Connection(host='localhost', port=10000, username='hive')
        cursor = conexion.cursor()
    except Exception as e:
        print(f"Error al conectar con Hive: {e}")
        return

    try:
        print(f"Eliminando tabla combinada '{nombre_tabla}' si ya existía...")
        cursor.execute(f"DROP TABLE IF EXISTS {nombre_tabla}")

        columnas = []
        for col_name, dtype in df.dtypes.items():
            if pd.api.types.is_integer_dtype(dtype):
                tipo_hive = 'INT'
            elif pd.api.types.is_float_dtype(dtype):
                tipo_hive = 'DOUBLE'
            else:
                tipo_hive = 'STRING'
            columnas.append(f"{col_name} {tipo_hive}")
            
        consulta_creacion = f"""
            CREATE TABLE {nombre_tabla} ({', '.join(columnas)}) 
            ROW FORMAT DELIMITED 
            FIELDS TERMINATED BY '\\t'
            STORED AS TEXTFILE
        """
        cursor.execute(consulta_creacion)
        print(f"Tabla '{nombre_tabla}' recreada correctamente con {len(columnas)} columnas.")
        
        print("Copiando datos masivos al contenedor Docker de Hive...")
        subprocess.run(["docker", "cp", archivo_temporal, "mi_hive:/tmp/volcado_temporal.tsv"], check=True)
        
        print("Cargando los datos directamente en Hive (Load Data Inpath)...")
        cursor.execute("SET hive.stats.autogather=false")
        cursor.execute(f"LOAD DATA LOCAL INPATH '/tmp/volcado_temporal.tsv' INTO TABLE {nombre_tabla}")
        
        print("Limpiando archivos temporales...")
        if os.path.exists(archivo_temporal):
            os.remove(archivo_temporal)
        subprocess.run(["docker", "exec", "mi_hive", "rm", "/tmp/volcado_temporal.tsv"], check=False)

        print(f"\n{'='*40}")
        print("¡Proceso completado! Todos los datos fueron insertados.")

    except subprocess.CalledProcessError as e:
        print(f"Error ejecutando comandos de Docker (¿Está iniciado el contenedor 'mi_hive'?): {e}")
    except Exception as e:
        print(f"Ocurrió un error inesperado al volcar a Hive: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conexion' in locals():
            conexion.close()

if __name__ == '__main__':
    rellenar_bd()
