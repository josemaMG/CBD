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


def sql_escape(value: str) -> str:
    return str(value).replace("'", "''")

def build_date_filter(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    conditions = []

    if year:
        conditions.append(f"CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) = {year}")
    if month:
        conditions.append(f"CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) = {month}")
    if region:
        safe_region = sql_escape(region)
        conditions.append(f"region = '{safe_region}'")
        
    return " AND ".join(conditions) if conditions else "1=1"


def build_safe_unix_ts_expr(column_name: str) -> str:
    normalized_col = f"regexp_replace({column_name}, '/', '-')"
    return (
        "COALESCE("
        f"unix_timestamp({normalized_col}, 'd-M-yyyy'),"
        f"unix_timestamp({normalized_col}, 'M-d-yyyy'),"
        f"unix_timestamp({normalized_col}, 'dd-MM-yyyy'),"
        f"unix_timestamp({normalized_col}, 'MM-dd-yyyy')"
        ")"
    )


def build_safe_double_expr(column_name: str) -> str:
    raw_col = f"trim(CAST({column_name} AS STRING))"
    return (
        "("
        "CASE "
        f"WHEN {raw_col} IS NULL OR {raw_col} = '' OR lower({raw_col}) = 'null' THEN NULL "
        f"WHEN instr({raw_col}, ',') > 0 AND instr({raw_col}, '.') > 0 AND instr({raw_col}, ',') > instr({raw_col}, '.') THEN CAST(regexp_replace(regexp_replace({raw_col}, '\\\\.', ''), ',', '.') AS DOUBLE) "
        f"WHEN instr({raw_col}, ',') > 0 AND instr({raw_col}, '.') > 0 THEN CAST(regexp_replace({raw_col}, ',', '') AS DOUBLE) "
        f"WHEN instr({raw_col}, ',') > 0 THEN CAST(regexp_replace({raw_col}, ',', '.') AS DOUBLE) "
        f"ELSE CAST({raw_col} AS DOUBLE) "
        "END"
        ")"
    )


@app.get("/api/filters")
def get_filters():
    """Retorna los años, meses y regiones únicos presentes en el dataset."""
    query = """
        SELECT DISTINCT 
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) as year_val, 
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) as month_val,
            region as region_val
        FROM superstore 
        WHERE order_date IS NOT NULL AND order_date != 'NULL'
    """
    data = fetch_data_as_dict(query)
    
    # Filter out invalid years/months
    years = sorted(list(set([r['year_val'] for r in data if r['year_val'] is not None and r['year_val'] > 2000])))
    months = sorted(list(set([r['month_val'] for r in data if r['month_val'] is not None and 1 <= r['month_val'] <= 12])))
    regions = sorted(list(set([r['region_val'] for r in data if r['region_val'] is not None and str(r['region_val']).strip() not in ('', 'NULL')])))
    
    return {"years": years, "months": months, "regions": regions}

@app.get("/api/kpi/sales_profit_by_region")
def get_sales_profit_region(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    # Which markets and regions generate the most sales and profit?
    date_filter = build_date_filter(year, month, region)
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

@app.get("/api/kpi/category_sales_rm")
def get_category_sales_rm(
    year: Optional[str] = None,
    month: Optional[str] = None,
    region: Optional[str] = None,
    market: Optional[str] = None,
    category: Optional[str] = None,
):
    date_filter = build_date_filter(year, month)
    conditions = []
    if date_filter != "1=1":
        conditions.append(date_filter)
    if region:
        safe_region = sql_escape(region)
        conditions.append(f"region = '{safe_region}'")
    if market:
        safe_market = sql_escape(market)
        conditions.append(f"lower(trim(market)) = lower(trim('{safe_market}'))")
    if category:
        safe_category = sql_escape(category)
        conditions.append(f"category = '{safe_category}'")

    filter_clause = " AND ".join(conditions) if conditions else "1=1"
    query = f"""
        SELECT 
            category,
            sub_category,
                        ROUND(SUM(CAST(sales AS DOUBLE)), 2) as total_sales
        FROM superstore
                WHERE {filter_clause}
                    AND category IS NOT NULL
          AND category != 'NULL'
          AND sub_category IS NOT NULL
          AND sub_category != 'NULL'
        GROUP BY category, sub_category
        ORDER BY total_sales DESC, category ASC, sub_category ASC
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/profit_leaks")
def get_profit_leaks(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None, limit: int = 10):
    date_filter = build_date_filter(year, month, region)
    sales_expr = build_safe_double_expr("sales")
    profit_expr = build_safe_double_expr("profit")
    discount_expr = build_safe_double_expr("discount")
    query = f"""
        SELECT
            product_name,
            sub_category,
            ROUND(SUM(COALESCE({sales_expr}, 0)), 2) as total_sales,
            ROUND(SUM(COALESCE({profit_expr}, 0)), 2) as total_profit,
            ROUND(COALESCE(AVG(COALESCE({discount_expr}, 0)), 0) * 100, 2) as avg_discount_pct
        FROM superstore
        WHERE {date_filter}
          AND product_name IS NOT NULL
          AND product_name != 'NULL'
          AND sub_category IS NOT NULL
          AND sub_category != 'NULL'
        GROUP BY product_name, sub_category
        HAVING SUM(COALESCE({profit_expr}, 0)) < 0
        ORDER BY total_sales DESC
        LIMIT {limit}
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/shipping_efficiency")
def get_shipping_efficiency(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    date_filter = build_date_filter(year, month, region)
    order_ts_expr = build_safe_unix_ts_expr("order_date")
    ship_ts_expr = build_safe_unix_ts_expr("ship_date")
    shipping_cost_expr = build_safe_double_expr("shipping_cost")
    query = f"""
        SELECT
            order_priority,
            ROUND(AVG(({ship_ts_expr} - {order_ts_expr}) / 86400.0), 2) as avg_days_to_ship,
            ROUND(AVG(COALESCE({shipping_cost_expr}, 0)), 2) as avg_shipping_cost,
            COUNT(DISTINCT order_id) as total_orders
        FROM superstore
        WHERE {date_filter}
          AND order_priority IS NOT NULL
          AND order_priority != 'NULL'
          AND {order_ts_expr} IS NOT NULL
          AND {ship_ts_expr} IS NOT NULL
        GROUP BY order_priority
        ORDER BY avg_days_to_ship ASC
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/pareto_customers")
def get_pareto_customers(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None, limit: int = 15):
    date_filter = build_date_filter(year, month, region)
    sales_expr = build_safe_double_expr("sales")
    profit_expr = build_safe_double_expr("profit")
    query = f"""
        SELECT
            customer_name,
            segment,
            COUNT(DISTINCT order_id) as total_orders,
            ROUND(SUM(COALESCE({sales_expr}, 0)), 2) as total_sales,
            ROUND(SUM(COALESCE({profit_expr}, 0)), 2) as total_profit
        FROM superstore
        WHERE {date_filter}
          AND customer_name IS NOT NULL
          AND customer_name != 'NULL'
          AND segment IS NOT NULL
          AND segment != 'NULL'
        GROUP BY customer_name, segment
        ORDER BY total_sales DESC
        LIMIT {limit}
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/seasonality_mom")
def get_seasonality_mom(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    date_filter = build_date_filter(year, month, region)
    sales_expr = build_safe_double_expr("sales")
    profit_expr = build_safe_double_expr("profit")
    query = f"""
        SELECT
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) as year,
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) as month,
            ROUND(SUM(COALESCE({sales_expr}, 0)), 2) as total_sales,
            ROUND(
                CASE
                    WHEN SUM(COALESCE({sales_expr}, 0)) = 0 THEN 0
                    ELSE (SUM(COALESCE({profit_expr}, 0)) / SUM(COALESCE({sales_expr}, 0))) * 100
                END,
                2
            ) as avg_profit_margin
        FROM superstore
        WHERE {date_filter}
          AND order_date IS NOT NULL
          AND order_date != 'NULL'
                    AND CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT) >= 2000
                    AND CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT) BETWEEN 1 AND 12
        GROUP BY
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[2] AS INT),
            CAST(split(regexp_replace(order_date, '/', '-'), '-')[1] AS INT)
        ORDER BY year ASC, month ASC
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/geo_margin_risk")
def get_geo_margin_risk(
    year: Optional[str] = None,
    month: Optional[str] = None,
    region: Optional[str] = None,
    min_sales: int = 10000,
    limit: int = 15,
):
    date_filter = build_date_filter(year, month, region)
    sales_expr = build_safe_double_expr("sales")
    profit_expr = build_safe_double_expr("profit")
    shipping_cost_expr = build_safe_double_expr("shipping_cost")
    query = f"""
        SELECT
            country,
            market,
            ROUND(SUM(COALESCE({sales_expr}, 0)), 2) as total_sales,
            ROUND(SUM(COALESCE({profit_expr}, 0)), 2) as total_profit,
            ROUND(
                CASE
                    WHEN SUM(COALESCE({sales_expr}, 0)) = 0 THEN 0
                    ELSE (SUM(COALESCE({profit_expr}, 0)) / SUM(COALESCE({sales_expr}, 0))) * 100
                END,
                2
            ) as profit_margin_percent,
            ROUND(SUM(COALESCE({shipping_cost_expr}, 0)), 2) as total_shipping_cost
        FROM superstore
        WHERE {date_filter}
          AND country IS NOT NULL
          AND country != 'NULL'
          AND market IS NOT NULL
          AND market != 'NULL'
        GROUP BY country, market
        HAVING SUM(COALESCE({sales_expr}, 0)) > {min_sales}
        ORDER BY profit_margin_percent ASC
        LIMIT {limit}
    """
    return fetch_data_as_dict(query)


@app.get("/api/kpi/profit_trend")
def get_profit_trend(year: Optional[str] = None, month: Optional[str] = None):
    # Profit trend driven by global year/month selectors.
    date_filter = build_date_filter(year, month)
    profit_expr = build_safe_double_expr("profit")
    order_ts_expr = build_safe_unix_ts_expr("order_date")
    query = f"""
        SELECT
            CAST(from_unixtime({order_ts_expr}, 'yyyy') AS INT) as year,
            CAST(from_unixtime({order_ts_expr}, 'M') AS INT) as month,
            ROUND(SUM(COALESCE({profit_expr}, 0)), 2) as total_profit
        FROM superstore
        WHERE {date_filter}
          AND order_date IS NOT NULL
          AND order_date != 'NULL'
          AND {order_ts_expr} IS NOT NULL
          AND CAST(from_unixtime({order_ts_expr}, 'yyyy') AS INT) >= 2000
          AND CAST(from_unixtime({order_ts_expr}, 'M') AS INT) BETWEEN 1 AND 12
        GROUP BY
            CAST(from_unixtime({order_ts_expr}, 'yyyy') AS INT),
            CAST(from_unixtime({order_ts_expr}, 'M') AS INT)
        ORDER BY year ASC, month ASC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/category_performance")
def get_category_performance(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    # Which product categories or sub-categories perform best?
    date_filter = build_date_filter(year, month, region)
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
def get_discount_impact(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    # How do discounts impact profitability?
    date_filter = build_date_filter(year, month, region)
    discount_expr = build_safe_double_expr("discount")
    profit_expr = build_safe_double_expr("profit")
    sales_expr = build_safe_double_expr("sales")
    # Normalizamos descuento a porcentaje entero para evitar puntos con el mismo % visible y distinto promedio.
    query = f"""
        SELECT
            discount_pct / 100.0 as discount,
            ROUND(AVG(profit_value), 2) as avg_profit,
            ROUND(SUM(profit_value), 2) as total_profit,
            ROUND(SUM(sales_value), 2) as total_sales,
            COUNT(*) as order_count
        FROM (
            SELECT
                CAST(ROUND(COALESCE({discount_expr}, 0) * 100) AS INT) as discount_pct,
                COALESCE({profit_expr}, 0) as profit_value,
                COALESCE({sales_expr}, 0) as sales_value
            FROM superstore
            WHERE {date_filter}
              AND discount IS NOT NULL
        ) normalized_discounts
        GROUP BY discount_pct
        ORDER BY discount_pct ASC
    """
    return fetch_data_as_dict(query)

@app.get("/api/kpi/shipping_modes")
def get_shipping_modes(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    # Solo agrupamos por modo de envío para que el gráfico Pie de React salga limpio
    date_filter = build_date_filter(year, month, region)
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
def get_customer_segments(year: Optional[str] = None, month: Optional[str] = None, region: Optional[str] = None):
    # Which customer segments contribute the most revenue?
    date_filter = build_date_filter(year, month, region)
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

@app.get("/api/kpi/custom_analysis")
def get_custom_analysis(
    region: Optional[str] = None,
    category: Optional[str] = None,
    year: Optional[str] = None,
    month: Optional[str] = None,
    limit: int = Query(default=10, ge=10, le=50),
):
    # Top categories/sub-categories ordered by total profit, aligned with global filters.
    date_filter = build_date_filter(year, month, region)
    sales_expr = build_safe_double_expr("sales")
    profit_expr = build_safe_double_expr("profit")

    conditions = [date_filter]
    if category:
        safe_category = sql_escape(category)
        conditions.append(f"category = '{safe_category}'")

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            category as Categoria,
            sub_category as Subcategoria,
            ROUND(SUM(COALESCE({sales_expr}, 0)), 2) as Ventas_Totales,
            SUM(quantity) as Cantidad_Total,
            ROUND(SUM(COALESCE({profit_expr}, 0)), 2) as Beneficio_Total
        FROM superstore
        WHERE {where_clause}
          AND category IS NOT NULL
          AND category != 'NULL'
          AND sub_category IS NOT NULL
          AND sub_category != 'NULL'
        GROUP BY category, sub_category
        ORDER BY Beneficio_Total DESC, Ventas_Totales DESC
        LIMIT {limit}
    """
    return fetch_data_as_dict(query)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
