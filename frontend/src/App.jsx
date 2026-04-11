import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import { Activity, ShoppingCart, TrendingDown, Truck, Users, Download, FileSpreadsheet, Search } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import './index.css';

const API_BASE = 'http://localhost:8000/api';

const COLORS = ['#38bdf8', '#e92a67', '#a853ba', '#2a8af6', '#fcd34d', '#4ade80'];

const Card = ({ title, icon: Icon, children, fullWidth }) => (
  <div className={`glass-panel chart-card ${fullWidth ? 'full-width' : ''}`}>
    <div className="chart-header">
      {Icon && <Icon size={24} color="#38bdf8" />}
      <h3 className="chart-title">{title}</h3>
    </div>
    <div className="chart-content">
      {children}
    </div>
  </div>
);

const Loader = () => (
  <div className="loader-container">
    <div className="loader"></div>
  </div>
);

function App() {
  const [filters, setFilters] = useState({ years: [], months: [], regions: [] });
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [draftYear, setDraftYear] = useState('');
  const [draftMonth, setDraftMonth] = useState('');
  const [draftRegion, setDraftRegion] = useState('');

  const [regionData, setRegionData] = useState([]);
  const [profitTrendData, setProfitTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [discountData, setDiscountData] = useState([]);
  const [shippingData, setShippingData] = useState([]);
  const [segmentData, setSegmentData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('principal');

  // Advanced Insights State
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState(null);
  const [profitLeakData, setProfitLeakData] = useState([]);
  const [shippingEfficiencyData, setShippingEfficiencyData] = useState([]);
  const [paretoCustomerData, setParetoCustomerData] = useState([]);
  const [seasonalityRawData, setSeasonalityRawData] = useState([]);
  const [geoMarginData, setGeoMarginData] = useState([]);
  
  // Region & Market Custom Filter State
  const [filterMarket, setFilterMarket] = useState('');
  const [categoryRmData, setCategoryRmData] = useState([]);

  // Custom Analysis State
  const [customCategory, setCustomCategory] = useState('');
  const [customData, setCustomData] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState(null);

  const dashboardRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/filters`)
      .then(res => res.json())
      .then(data => setFilters(data))
      .catch(err => console.error('Error fetching filters', err));
  }, []);

  const buildGlobalQuery = ({ includeRegion = true } = {}) => {
    const params = new URLSearchParams();
    if (selectedYear) params.set('year', selectedYear);
    if (selectedMonth) params.set('month', selectedMonth);
    if (includeRegion && selectedRegion) params.set('region', selectedRegion);
    const queryStr = params.toString();
    return queryStr ? `?${queryStr}` : '?';
  };

  const hasPendingGlobalFilters =
    draftYear !== selectedYear ||
    draftMonth !== selectedMonth ||
    draftRegion !== selectedRegion;

  const handleApplyGlobalFilters = () => {
    setSelectedYear(draftYear);
    setSelectedMonth(draftMonth);
    setSelectedRegion(draftRegion);
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const query = buildGlobalQuery();
        const profitQuery = buildGlobalQuery({ includeRegion: false });

        const [regionRes, profitRes, catRes, discRes, shipRes, segRes] = await Promise.all([
          fetch(`${API_BASE}/kpi/sales_profit_by_region${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/profit_trend${profitQuery}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/category_performance${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/discount_impact${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/shipping_modes${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/customer_segments${query}`).then(r => r.json())
        ]);

        const sortedProfitData = Array.isArray(profitRes)
          ? [...profitRes]
              .map(item => ({
                ...item,
                year: Number(item.year) || 0,
                month: Number(item.month) || 0,
                total_profit: Number(item.total_profit) || 0,
              }))
              .sort((a, b) => (a.year - b.year) || (a.month - b.month))
          : [];

        const sortedCategoryData = Array.isArray(catRes)
          ? [...catRes].sort((a, b) => Number(b.total_sales) - Number(a.total_sales))
          : [];

        setRegionData(regionRes);
        setProfitTrendData(sortedProfitData);
        setCategoryData(sortedCategoryData);
        setDiscountData(discRes);
        setShippingData(shipRes);
        setSegmentData(segRes);

      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [selectedYear, selectedMonth, selectedRegion]);

  useEffect(() => {
    if (activeTab !== 'insights') {
      return;
    }

    const fetchAdvancedInsights = async () => {
      setAdvancedLoading(true);
      setAdvancedError(null);

      try {
        const query = buildGlobalQuery();
        const [
          profitLeakRes,
          shippingEffRes,
          paretoRes,
          seasonalityRes,
          geoMarginRes,
        ] = await Promise.all([
          fetch(`${API_BASE}/kpi/profit_leaks${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/shipping_efficiency${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/pareto_customers${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/seasonality_mom${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/geo_margin_risk${query}`).then(r => r.json()),
        ]);

        const normalizeNumber = (value) => {
          const normalized = Number(value);
          return Number.isNaN(normalized) ? 0 : normalized;
        };

        const normalizedProfitLeaks = Array.isArray(profitLeakRes)
          ? profitLeakRes.map(item => ({
              ...item,
              total_sales: normalizeNumber(item.total_sales),
              total_profit: normalizeNumber(item.total_profit),
              avg_discount_pct: normalizeNumber(item.avg_discount_pct),
            }))
          : [];

        const normalizedShippingEff = Array.isArray(shippingEffRes)
          ? shippingEffRes.map(item => ({
              ...item,
              avg_days_to_ship: normalizeNumber(item.avg_days_to_ship),
              avg_shipping_cost: normalizeNumber(item.avg_shipping_cost),
              total_orders: normalizeNumber(item.total_orders),
            }))
          : [];

        const normalizedPareto = Array.isArray(paretoRes)
          ? paretoRes.map(item => ({
              ...item,
              total_orders: normalizeNumber(item.total_orders),
              total_sales: normalizeNumber(item.total_sales),
              total_profit: normalizeNumber(item.total_profit),
            }))
            .filter(item => item.total_sales > 0)
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 15)
          : [];

        const normalizedSeasonality = Array.isArray(seasonalityRes)
          ? seasonalityRes.map(item => ({
              ...item,
              year: normalizeNumber(item.year),
              month: normalizeNumber(item.month),
              total_sales: normalizeNumber(item.total_sales),
              avg_profit_margin: normalizeNumber(item.avg_profit_margin),
            }))
            .filter(item => item.year >= 2000 && item.month >= 1 && item.month <= 12)
          : [];

        const normalizedGeoMargin = Array.isArray(geoMarginRes)
          ? geoMarginRes.map(item => ({
              ...item,
              total_sales: normalizeNumber(item.total_sales),
              total_profit: normalizeNumber(item.total_profit),
              profit_margin_percent: normalizeNumber(item.profit_margin_percent),
              total_shipping_cost: normalizeNumber(item.total_shipping_cost),
            }))
          : [];

        setProfitLeakData(normalizedProfitLeaks);
        setShippingEfficiencyData(normalizedShippingEff);
        setParetoCustomerData(normalizedPareto);
        setSeasonalityRawData(normalizedSeasonality);
        setGeoMarginData(normalizedGeoMargin);
      } catch (err) {
        console.error('Error fetching advanced insights', err);
        setAdvancedError('No se pudieron cargar los insights avanzados.');
      } finally {
        setAdvancedLoading(false);
      }
    };

    fetchAdvancedInsights();
  }, [selectedYear, selectedMonth, selectedRegion, activeTab]);

  const handleCustomAnalysis = async (categoryFilter = customCategory) => {
    setCustomLoading(true);
    setCustomError(null);
    setCustomData(null);
    try {
      const params = new URLSearchParams();
      if (selectedRegion) params.set('region', selectedRegion);
      if (selectedYear) params.set('year', selectedYear);
      if (selectedMonth) params.set('month', selectedMonth);
      const normalizedCategory = (categoryFilter || '').trim();
      if (normalizedCategory) params.set('category', normalizedCategory);
      const query = params.toString() ? `?${params.toString()}` : '?';

      const res = await fetch(`${API_BASE}/kpi/custom_analysis${query}`);
      if (!res.ok) throw new Error('Error al ejecutar la consulta dinámica');
      const data = await res.json();
      const sortedCustomData = Array.isArray(data)
        ? [...data].sort(
            (a, b) =>
              (Number(b.ventas_totales) - Number(a.ventas_totales)) ||
              (Number(b.beneficio_total) - Number(a.beneficio_total))
          )
        : [];
      setCustomData(sortedCustomData);
    } catch (err) {
      setCustomError(err.message);
    } finally {
      setCustomLoading(false);
    }
  };

  const handleFetchCategoryRM = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.set('year', selectedYear);
      if (selectedMonth) params.set('month', selectedMonth);
      if (selectedRegion) params.set('region', selectedRegion);
      if (filterMarket) params.set('market', filterMarket);

      const query = params.toString() ? `?${params.toString()}` : '?';

      const res = await fetch(`${API_BASE}/kpi/category_sales_rm${query}`);
      const data = await res.json();
      const sortedCategoryRmData = Array.isArray(data)
        ? [...data].sort((a, b) => Number(b.total_sales) - Number(a.total_sales))
        : [];
      setCategoryRmData(sortedCategoryRmData);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch initial generic data for the new chart
  useEffect(() => {
    handleFetchCategoryRM();
  }, [selectedYear, selectedMonth, selectedRegion, filterMarket]);

  useEffect(() => {
    if (activeTab !== 'principal') return;
    handleCustomAnalysis(customCategory);
  }, [selectedYear, selectedMonth, selectedRegion, customCategory, activeTab]);

  const formatCurrency = (value) => `$${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const hasBeneficioPromedio = payload.some(entry => entry.name === 'Beneficio Promedio');
      return (
        <div className="glass-panel" style={{ padding: '10px', fontSize: '0.9rem' }}>
          {!hasBeneficioPromedio && (
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', textTransform: 'capitalize' }}>{label}</p>
          )}
          {payload.map((entry, index) => {
            const isCurrency = entry.name.toLowerCase().includes('ventas') || 
                               entry.name.toLowerCase().includes('beneficio') || 
                               entry.name.toLowerCase().includes('ingresos') ||
                               entry.name.toLowerCase().includes('coste');
            return (
              <p key={`item-${index}`} style={{ color: entry.color, margin: '5px 0' }}>
                {entry.name}: {isCurrency ? formatCurrency(entry.value) : entry.value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const handleDownloadPDF = async () => {
    if (!dashboardRef.current) return;
    
    const nombreMes = selectedMonth 
      ? new Date(0, parseInt(selectedMonth) - 1).toLocaleString('es', { month: 'long' }) 
      : 'Todos';
    const nombreAnio = selectedYear ? selectedYear : 'Todos';

    const canvas = await html2canvas(dashboardRef.current, { 
      scale: 2, 
      backgroundColor: '#0f172a',
      useCORS: true
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFillColor(15, 23, 42); 
    pdf.rect(0, 0, pdfWidth, 90, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text("Reporte de KPIs - Superstore", 40, 45);
    pdf.setFontSize(14);
    pdf.setTextColor(56, 189, 248);
    pdf.text(`Filtro aplicado -> AÑO: ${nombreAnio} | MES: ${nombreMes.toUpperCase()}`, 40, 70);

    const margin = 20;
    const imgY = 110;
    const imgProps = pdf.getImageProperties(imgData);
    const printableWidth = pdfWidth - (margin * 2);
    const scaledHeight = (imgProps.height * printableWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', margin, imgY, printableWidth, scaledHeight);
    
    const safeDateStr = `${nombreMes}_${nombreAnio}`;
    pdf.save(`Superstore_KPI_Report_${safeDateStr}.pdf`);
  };

  const handleDownloadExcel = () => {
    const nombreMes = selectedMonth 
      ? new Date(0, parseInt(selectedMonth) - 1).toLocaleString('es', { month: 'long' }) 
      : 'Todos';
    const nombreAnio = selectedYear ? selectedYear : 'Todos';
    
    const workbook = XLSX.utils.book_new();

    // 1. Regiones
    const wsRegion = XLSX.utils.json_to_sheet(regionData.map(d => ({
      'Región': d.region,
      'Mercado': d.market,
      'Ventas Totales ($)': d.total_sales,
      'Beneficio Total ($)': d.total_profit
    })));
    XLSX.utils.book_append_sheet(workbook, wsRegion, 'Regiones');

    // 2. Categorías
    const wsCat = XLSX.utils.json_to_sheet(categoryData.map(d => ({
      'Categoría principal': d.category,
      'Sub-categoría': d.sub_category,
      'Ventas Totales ($)': d.total_sales,
      'Beneficio Total ($)': d.total_profit,
      'Artículos Vendidos (uds)': d.total_quantity
    })));
    XLSX.utils.book_append_sheet(workbook, wsCat, 'Categorías');

    // 3. Descuentos
    const wsDisc = XLSX.utils.json_to_sheet(discountData.map(d => ({
      'Descuento Aplicado (%)': d.discount * 100,
      'Número de Pedidos': d.order_count,
      'Beneficio Medio por Pedido ($)': d.avg_profit,
      'Beneficio Total ($)': d.total_profit,
      'Ventas Totales ($)': d.total_sales
    })));
    XLSX.utils.book_append_sheet(workbook, wsDisc, 'Descuentos');

    // 4. Modos de Envío
    const wsShip = XLSX.utils.json_to_sheet(shippingData.map(d => ({
      'Modo de Envío seleccionado': d.ship_mode,
      'Veces Utilizado': d.frequency,
      'Coste de Envío Promedio ($)': d.avg_cost
    })));
    XLSX.utils.book_append_sheet(workbook, wsShip, 'Envíos');

    // 5. Segmentos
    const wsSeg = XLSX.utils.json_to_sheet(segmentData.map(d => ({
      'Segmento de Cliente': d.segment,
      'Recuento de Clientes (Únicos)': d.total_customers,
      'Total Ingresos Generados ($)': d.total_revenue,
      'Beneficio Total Aportado ($)': d.total_profit
    })));
    XLSX.utils.book_append_sheet(workbook, wsSeg, 'Segmentos Cliente');

    const safeDateStr = `${nombreMes}_${nombreAnio}`;
    XLSX.writeFile(workbook, `Superstore_Export_${safeDateStr}.xlsx`);
  };

  const validProfits = discountData.filter(i => i.avg_profit !== null && i.avg_profit !== undefined).map(i => Number(i.avg_profit)).filter(n => !isNaN(n));
  const maxProfit = validProfits.length ? Math.max(...validProfits) : 0;
  const minProfit = validProfits.length ? Math.min(...validProfits) : 0;
  const gradientOffset = (maxProfit > 0 && minProfit < 0) ? (maxProfit / (maxProfit - minProfit)) : (maxProfit <= 0 ? 1 : 0);
  const offsetPercent = `${(gradientOffset * 100).toFixed(4)}%`;
  const gradientId = `splitColor-${maxProfit}-${minProfit}`.replace(/\./g, '-');

  const mappedRegionData = regionData.map(d => ({
    ...d,
    regionMarket: `${d.region} (${d.market})`
  }));

  const availableMarkets = useMemo(() => {
    const uniqueMarkets = new Set(
      regionData
        .map(item => item.market)
        .filter(market => market && market !== 'NULL')
    );
    return [...uniqueMarkets].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [regionData]);

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const profitTrendChartData = useMemo(() => {
    return profitTrendData.map(item => {
      const safeMonth = item.month >= 1 && item.month <= 12 ? item.month : 1;
      let period = `${monthNames[safeMonth - 1]} ${item.year}`;

      if (selectedYear && !selectedMonth) {
        period = monthNames[safeMonth - 1];
      } else if (!selectedYear && selectedMonth) {
        period = `${item.year}`;
      }

      return { ...item, period };
    });
  }, [profitTrendData, selectedYear, selectedMonth]);

  const segmentColors = {
    Consumer: '#38bdf8',
    Corporate: '#a853ba',
    'Home Office': '#fcd34d',
  };

  const geoMarginChartData = useMemo(
    () => geoMarginData.map(item => ({ ...item, countryMarket: `${item.country} (${item.market})` })),
    [geoMarginData],
  );

  const seasonalityYears = useMemo(() => {
    const years = [...new Set(seasonalityRawData.map(item => String(item.year)))];
    return years.sort((a, b) => Number(a) - Number(b));
  }, [seasonalityRawData]);

  const seasonalityChartData = useMemo(() => {
    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const salesLookup = {};

    seasonalityRawData.forEach(item => {
      salesLookup[`${item.year}-${item.month}`] = Number(item.total_sales) || 0;
    });

    return monthLabels.map((label, index) => {
      const monthNumber = index + 1;
      const monthRow = { month: label };
      seasonalityYears.forEach(year => {
        monthRow[year] = salesLookup[`${year}-${monthNumber}`] ?? 0;
      });
      return monthRow;
    });
  }, [seasonalityRawData, seasonalityYears]);

  const availableCustomCategories = useMemo(() => {
    const uniqueCategories = new Set(
      categoryData
        .map(item => item.category)
        .filter(category => category && category !== 'NULL')
    );
    return [...uniqueCategories].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [categoryData]);

  const ProfitLeakTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload;
    return (
      <div className="glass-panel" style={{ padding: '10px', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{point.product_name}</p>
        <p style={{ margin: '5px 0' }}>Sub-categoría: {point.sub_category}</p>
        <p style={{ margin: '5px 0', color: '#38bdf8' }}>Ventas: {formatCurrency(point.total_sales)}</p>
        <p style={{ margin: '5px 0', color: '#ef4444' }}>Beneficio: {formatCurrency(point.total_profit)}</p>
        <p style={{ margin: '5px 0', color: '#fcd34d' }}>Descuento promedio: {point.avg_discount_pct.toFixed(2)}%</p>
      </div>
    );
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isPositive = Number(payload.avg_profit) >= 0;
    return <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={isPositive ? "#4ade80" : "#ef4444"} strokeWidth={2} />;
  };

  const CustomActiveDot = (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const isPositive = Number(payload.avg_profit) >= 0;
    return <circle cx={cx} cy={cy} r={6} fill={isPositive ? "#4ade80" : "#ef4444"} stroke="#fff" strokeWidth={2} />;
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div className="header-title-block">
          <h1 className="title-glow">Análisis de Ventas Superstore</h1>
        </div>

        <div className="header-filter-block">
          <div className="filters-container">
            <div className="filter-group">
              <label>Año</label>
              <select value={draftYear} onChange={(e) => setDraftYear(e.target.value)}>
                <option value="">Todos los años</option>
                {filters.years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Mes</label>
              <select value={draftMonth} onChange={(e) => setDraftMonth(e.target.value)}>
                <option value="">Todos los meses</option>
                {filters.months.map(m => (
                  <option key={m} value={m} style={{ textTransform: 'capitalize' }}>
                    {new Date(0, m - 1).toLocaleString('es', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Región</label>
              <select value={draftRegion} onChange={(e) => setDraftRegion(e.target.value)}>
                <option value="">Todas las regiones</option>
                {filters.regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="header-action-group">
            <button
               onClick={handleApplyGlobalFilters}
               disabled={loading || !hasPendingGlobalFilters}
              className={`header-apply-btn ${hasPendingGlobalFilters ? 'is-ready' : ''}`}
            >
              Aplicar filtros
            </button>
            <button 
               onClick={handleDownloadExcel} 
               disabled={loading}
               className="header-action-btn excel-btn"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button 
               onClick={handleDownloadPDF} 
               disabled={loading}
               className="header-action-btn pdf-btn"
            >
              <Download size={18} />
              PDF
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem', padding: '0 20px 10px 20px' }}>
        <button
          onClick={() => setActiveTab('principal')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            background: activeTab === 'principal' ? 'linear-gradient(to right, #38bdf8, #2a8af6)' : 'rgba(15, 23, 42, 0.65)',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Panel Principal
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1px solid rgba(233, 42, 103, 0.35)',
            background: activeTab === 'insights' ? 'linear-gradient(to right, #e92a67, #a853ba)' : 'rgba(15, 23, 42, 0.65)',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Insights Avanzados
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : activeTab === 'principal' ? (
        <div className="dashboard-grid" ref={dashboardRef} style={{ padding: '20px', borderRadius: '16px' }}>
          
          {!selectedRegion && (
            <Card title="Ventas Totales por Región" icon={Activity} fullWidth>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={mappedRegionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="regionMarket" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_sales" name="Ventas Totales" fill="#38bdf8" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card title="Beneficios según Mes y Año" icon={TrendingDown} fullWidth>
            {profitTrendChartData.length === 0 ? (
              <p style={{ margin: 0, color: '#94a3b8' }}>No hay datos de beneficio para el filtro seleccionado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={profitTrendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="period" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total_profit" name="Beneficio Total" stroke="#4ade80" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 2. Product Categories */}
          <Card title="Rendimiento por Subcategorías" icon={ShoppingCart}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sub_category" stroke="#94a3b8" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total_sales" stroke="#a853ba" fill="#a853ba" fillOpacity={0.3} name="Ventas" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 3. Discount Impact */}
          <Card title="Descuento vs Beneficio" icon={TrendingDown}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={discountData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset={offsetPercent} stopColor="#4ade80" />
                    <stop offset={offsetPercent} stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="discount" stroke="#94a3b8" tickFormatter={val => `${(val*100).toFixed(0)}%`} />
                <YAxis stroke="#94a3b8" tickFormatter={val => `$${val.toFixed(0)}`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="linear" dataKey="avg_profit" stroke={`url(#${gradientId})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" name="Beneficio Promedio" dot={<CustomDot />} activeDot={<CustomActiveDot />} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* 4. Shipping Modes */}
          <Card title="Modos de Envío" icon={Truck}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={shippingData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="frequency"
                  nameKey="ship_mode"
                  label={({ ship_mode, percent }) => `${ship_mode} ${(percent * 100).toFixed(0)}%`}
                >
                  {shippingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* 5. Customer Segments */}
          <Card title="Ingresos por Segmento" icon={Users}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={segmentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                <YAxis dataKey="segment" type="category" width={100} stroke="#94a3b8" />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" fill="#fcd34d" radius={[0, 4, 4, 0]} name="Ingresos Totales" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 6. Categorías por Región y Mercado (Filtro interactivo) */}
           <Card title="Ventas de Subcategorías por Mercado" icon={Activity} fullWidth>
            <div className="market-filter-shell">
              <div className="market-filter-row">
                <div className="filter-group">
                  <label>Mercado</label>
                  <select
                    value={filterMarket}
                    onChange={(e) => setFilterMarket(e.target.value)}
                    style={{ minWidth: '220px' }}
                  >
                    <option value="">Todos los mercados</option>
                    {availableMarkets.map((market) => (
                      <option key={market} value={market}>{market}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryRmData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sub_category" stroke="#94a3b8" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="total_sales" fill="#38bdf8" name="Ventas Totales" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

        </div>
      ) : (
        <div ref={dashboardRef} style={{ padding: '0 20px 20px 20px' }}>
          {advancedLoading ? (
            <Loader />
          ) : advancedError ? (
            <div className="glass-panel chart-card full-width" style={{ padding: '1rem', color: '#ef4444' }}>
              {advancedError}
            </div>
          ) : (
            <div className="dashboard-grid" style={{ borderRadius: '16px' }}>
              <Card title="Fugas de Rentabilidad (Ventas Altas con Beneficio Negativo)" icon={TrendingDown} fullWidth>
                {profitLeakData.length === 0 ? (
                  <p style={{ margin: 0, color: '#94a3b8' }}>No hay productos con beneficio negativo para el filtro actual.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" dataKey="total_sales" name="Ventas Totales" stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                      <YAxis type="number" dataKey="total_profit" name="Beneficio Total" stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                      <ZAxis type="number" dataKey="avg_discount_pct" name="Descuento Promedio" range={[80, 800]} />
                      <RechartsTooltip content={<ProfitLeakTooltip />} />
                      <Scatter name="Productos en riesgo" data={profitLeakData} fill="#e92a67" />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Eficiencia Logística (Time-to-Ship)" icon={Truck}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={shippingEfficiencyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="order_priority" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={val => `${val.toFixed(1)}d`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#fcd34d" tickFormatter={val => `$${val.toFixed(0)}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="avg_days_to_ship" name="Días Promedio" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_shipping_cost" name="Coste Envío Promedio" stroke="#fcd34d" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Pareto de Clientes (Top 15)" icon={Users}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={paretoCustomerData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                    <YAxis dataKey="customer_name" type="category" width={140} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_sales" name="Ventas Totales" radius={[0, 4, 4, 0]}>
                      {paretoCustomerData.map((entry, index) => (
                        <Cell key={`${entry.customer_name}-${index}`} fill={segmentColors[entry.segment] || '#38bdf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {!(selectedYear && selectedMonth) && (
                <Card title="Estacionalidad de Ventas (MoM)" icon={Activity} fullWidth>
                  {seasonalityYears.length === 0 ? (
                    <p style={{ margin: 0, color: '#94a3b8' }}>No hay datos de estacionalidad para el filtro actual.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={seasonalityChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend />
                        {seasonalityYears.map((yearKey, index) => (
                          <Line
                            key={yearKey}
                            type="monotone"
                            dataKey={yearKey}
                            name={`Ventas ${yearKey}`}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              )}

              <Card title="Geoespacial de Márgenes (Riesgo por País/Mercado)" icon={Activity} fullWidth>
                {geoMarginChartData.length === 0 ? (
                  <p style={{ margin: 0, color: '#94a3b8' }}>No hay países con ventas suficientes para analizar márgenes en este filtro.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={geoMarginChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" stroke="#94a3b8" tickFormatter={val => `${val.toFixed(1)}%`} />
                      <YAxis dataKey="countryMarket" type="category" width={180} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="profit_margin_percent" name="Margen Beneficio (%)" radius={[0, 4, 4, 0]}>
                        {geoMarginChartData.map((entry, index) => (
                          <Cell key={`${entry.countryMarket}-${index}`} fill={entry.profit_margin_percent < 0 ? '#ef4444' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'principal' && (
      <div style={{ padding: '0 20px 20px 20px' }}>
        <Card title="Mejores Ventas por Categoría" icon={Search} fullWidth>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
             <div className="filter-group">
                <label>Categoría</label>
                <select
                  value={customCategory} 
                  onChange={(e) => setCustomCategory(e.target.value)} 
                  style={{ minWidth: '220px' }}
                >
                  <option value="">Todas las categorías</option>
                  {availableCustomCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
             </div>
               {customLoading && (
                <span style={{ color: '#9fc0de', fontSize: '0.9rem' }}>Actualizando resultados...</span>
               )}
          </div>

          {customError && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{customError}</div>}

          {customData && (
             <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                   <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                         <th style={{ padding: '10px' }}>Categoría</th>
                         <th style={{ padding: '10px' }}>Ventas Totales</th>
                         <th style={{ padding: '10px' }}>Cantidad</th>
                         <th style={{ padding: '10px' }}>Beneficio Total</th>
                      </tr>
                   </thead>
                   <tbody>
                      {customData.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '10px', textAlign: 'center' }}>No se encontraron resultados</td></tr>
                      ) : (
                        customData.map((row, idx) => (
                           <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '10px' }}>{row.categoria || '-'}</td>
                              <td style={{ padding: '10px' }}>{formatCurrency(row.ventas_totales)}</td>
                              <td style={{ padding: '10px' }}>{row.cantidad_total}</td>
                              <td style={{ padding: '10px', color: row.beneficio_total >= 0 ? '#4ade80' : '#ef4444' }}>
                                {formatCurrency(row.beneficio_total)}
                              </td>
                           </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          )}
        </Card>
      </div>
      )}

    </div>
  );
}

export default App;
