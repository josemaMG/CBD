from pyhive import hive

def vaciar_bd():
    try:
        conexion = hive.Connection(host='localhost', port=10000, username='hive')
        cursor = conexion.cursor()
        
        print("Buscando las tablas existentes en la base de datos...")
        cursor.execute("SHOW TABLES")
        tablas = cursor.fetchall()
        
        if not tablas:
            print("No hay ninguna tabla en Hive para eliminar. La base de datos ya está limpia.")
        else:
            print(f"Se identificaron {len(tablas)} tabla(s) para eliminar.")
            for tabla in tablas:
                nombre_tabla = tabla[0]
                print(f"Eliminando la tabla: '{nombre_tabla}'...")
                cursor.execute(f"DROP TABLE IF EXISTS {nombre_tabla}")
            print("¡Todas las tablas fueron eliminadas exitosamente y la base de datos está vacía!")
            
    except Exception as e:
        print(f"Ocurrió un error al intentar vaciar la base de datos: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conexion' in locals():
            conexion.close()

if __name__ == '__main__':
    vaciar_bd()
