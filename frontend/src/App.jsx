import { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Activity, ShoppingCart, TrendingDown, Truck, Users, Download, FileSpreadsheet } from 'lucide-react';
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
  const [filters, setFilters] = useState({ years: [], months: [] });
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const [regionData, setRegionData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [discountData, setDiscountData] = useState([]);
  const [shippingData, setShippingData] = useState([]);
  const [segmentData, setSegmentData] = useState([]);

  const [loading, setLoading] = useState(true);
  
  const dashboardRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/filters`)
      .then(res => res.json())
      .then(data => setFilters(data))
      .catch(err => console.error('Error fetching filters', err));
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        let query = '?';
        if (selectedYear) query += `year=${selectedYear}&`;
        if (selectedMonth) query += `month=${selectedMonth}`;

        const [regionRes, catRes, discRes, shipRes, segRes] = await Promise.all([
          fetch(`${API_BASE}/kpi/sales_profit_by_region${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/category_performance${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/discount_impact${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/shipping_modes${query}`).then(r => r.json()),
          fetch(`${API_BASE}/kpi/customer_segments${query}`).then(r => r.json())
        ]);

        setRegionData(regionRes);
        setCategoryData(catRes);
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
  }, [selectedYear, selectedMonth]);

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
                               entry.name.toLowerCase().includes('ingresos');
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
    regionMarket: `${d.region} (${d.market})`,
    fillColor: Number(d.total_profit) >= 0 ? '#4ade80' : '#ef4444'
  }));

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
      <header>
        <div>
          <h1 className="title-glow">Análisis de Ventas Superstore</h1>
        </div>
        
        <div className="filters-container">
          <div className="filter-group">
            <label>Año</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              <option value="">Todos los años</option>
              {filters.years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Mes</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">Todos los meses</option>
              {filters.months.map(m => (
                <option key={m} value={m} style={{ textTransform: 'capitalize' }}>
                  {new Date(0, m - 1).toLocaleString('es', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
            <button 
               onClick={handleDownloadExcel} 
               disabled={loading}
               style={{
                 padding: '0.75rem 1.25rem',
                 background: 'linear-gradient(to right, #22c55e, #15803d)',
                 color: 'white',
                 border: 'none',
                 borderRadius: '8px',
                 fontWeight: 'bold',
                 cursor: 'pointer',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.5rem',
                 boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                 transition: 'transform 0.2s'
               }}
               onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
               onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button 
               onClick={handleDownloadPDF} 
               disabled={loading}
               style={{
                 padding: '0.75rem 1.25rem',
                 background: 'linear-gradient(to right, #38bdf8, #2a8af6)',
                 color: 'white',
                 border: 'none',
                 borderRadius: '8px',
                 fontWeight: 'bold',
                 cursor: 'pointer',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.5rem',
                 boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)',
                 transition: 'transform 0.2s'
               }}
               onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
               onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Download size={18} />
              PDF
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <Loader />
      ) : (
        <div className="dashboard-grid" ref={dashboardRef} style={{ padding: '20px', borderRadius: '16px' }}>
          
          {/* 1a. Sales by Region */}
          <Card title="Ventas Totales por Región" icon={Activity} fullWidth>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={regionData.map(d => ({ ...d, regionMarket: `${d.region} (${d.market})` }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="regionMarket" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="total_sales" fill="#38bdf8" name="Ventas Totales" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 1b. Profit by Region */}
          <Card title="Beneficio Total por Región" icon={Activity} fullWidth>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={mappedRegionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="regionMarket" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={val => `$${val/1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="total_profit" name="Beneficio Total" radius={[4,4,0,0]}>
                  {mappedRegionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 2. Product Categories */}
          <Card title="Rendimiento por Categoría" icon={ShoppingCart}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={categoryData.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sub_category" stroke="#94a3b8" angle={-45} textAnchor="end" height={60} />
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

        </div>
      )}
    </div>
  );
}

export default App;
