import json
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pyhive import hive
import pandas as pd

def get_hive_connection():
    try:
        return hive.Connection(host='localhost', port=10000, username='hive')
    except Exception as e:
        print(f"Error connectando a Hive: {e}")
        return None

def fetch_data_as_dict(query: str) -> List[Dict[str, Any]]:
    conn = get_hive_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        return results
    except Exception as e:
        print(f"Query error: {e}\nQuery: {query}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Iniciando backend FastAPI...")
    yield
    print("Apagando backend...")

app = FastAPI(title="Superstore Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def build_date_filter(year: Optional[str] = None, month: Optional[str] = None):
    conditions = []

    if year:
        conditions.append(f"CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) = {year}")
    if month:
        conditions.append(f"CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) = {month}")
        
    return " AND ".join(conditions) if conditions else "1=1"


@app.get("/api/filters")
def get_filters():
    """Retorna los años y meses únicos presentes en el dataset."""
    query = """
        SELECT DISTINCT 
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) as year_val, 
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) as month_val 
        FROM superstore 
        WHERE order_date IS NOT NULL AND order_date != 'NULL'
    """
    data = fetch_data_as_dict(query)
    
    # Filter out invalid years/months
    years = sorted(list(set([r['year_val'] for r in data if r['year_val'] is not None and r['year_val'] > 2000])))
    months = sorted(list(set([r['month_val'] for r in data if r['month_val'] is not None and 1 <= r['month_val'] <= 12])))
    
    return {"years": years, "months": months}

@app.get("/api/kpi/sales_profit_by_region")
def get_sales_profit_region(year: Optional[str] = None, month: Optional[str] = None):
    # Which markets and regions generate the most sales and profit?
    date_filter = build_date_filter(year, month)
    query = f"""
        SELECT 
            region,
            market,
            SUM(CAST(sales AS DOUBLE)) as total_sales,
            SUM(profit) as total_profit
        FROM superstore
        WHERE {date_filter}
        GROUP BY region, market
        ORDER BY total_sales DESC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/category_performance")
def get_category_performance(year: Optional[str] = None, month: Optional[str] = None):
    # Which product categories or sub-categories perform best?
    date_filter = build_date_filter(year, month)
    query = f"""
        SELECT 
            category,
            sub_category,
            SUM(CAST(sales AS DOUBLE)) as total_sales,
            SUM(profit) as total_profit,
            SUM(quantity) as total_quantity
        FROM superstore
        WHERE {date_filter}
        GROUP BY category, sub_category
        ORDER BY total_sales DESC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/discount_impact")
def get_discount_impact(year: Optional[str] = None, month: Optional[str] = None):
    # How do discounts impact profitability?
    date_filter = build_date_filter(year, month)
    # Agrupamos los descuentos en "tramos" o mostramos por cada valor de descuento único
    query = f"""
        SELECT 
            discount,
            AVG(profit) as avg_profit,
            SUM(profit) as total_profit,
            SUM(CAST(sales AS DOUBLE)) as total_sales,
            COUNT(*) as order_count
        FROM superstore
        WHERE {date_filter} AND discount IS NOT NULL
        GROUP BY discount
        ORDER BY discount ASC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/shipping_modes")
def get_shipping_modes(year: Optional[str] = None, month: Optional[str] = None):
    # Solo agrupamos por modo de envío para que el gráfico Pie de React salga limpio
    date_filter = build_date_filter(year, month)
    query = f"""
        SELECT 
            ship_mode,
            COUNT(*) as frequency,
            AVG(shipping_cost) as avg_cost
        FROM superstore
        WHERE {date_filter} AND ship_mode IS NOT NULL AND ship_mode != 'NULL'
        GROUP BY ship_mode
        ORDER BY frequency DESC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/customer_segments")
def get_customer_segments(year: Optional[str] = None, month: Optional[str] = None):
    # Which customer segments contribute the most revenue?
    date_filter = build_date_filter(year, month)
    query = f"""
        SELECT 
            segment,
            COUNT(DISTINCT customer_id) as total_customers,
            SUM(CAST(sales AS DOUBLE)) as total_revenue,
            SUM(profit) as total_profit
        FROM superstore
        WHERE {date_filter} AND segment IS NOT NULL AND segment != 'NULL'
        GROUP BY segment
        ORDER BY total_revenue DESC
    """
    return fetch_data_as_dict(query)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
