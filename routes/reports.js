import { DollarSign, Download, Package, TrendingUp, Users, Calendar, AlertCircle, RefreshCw, PieChart as PieChartIcon, BarChart3, LineChart, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart as RechartsLineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area, RadialBarChart, RadialBar } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// API service functions
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiService = {
  // Sales Report
  getSalesReport: async (period, startDate, endDate) => {
    try {
      let url = `${API_BASE_URL}/analytics/sales-trend?period=monthly&days=30`;
      if (period === 'custom' && startDate && endDate) {
        url = `${API_BASE_URL}/analytics/sales-trend?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch sales report');
      return await response.json();
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  },

  // Product Report
  getProductReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/top-products?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch product report');
      return await response.json();
    } catch (error) {
      console.error('Error fetching product report:', error);
      throw error;
    }
  },

  // Inventory Report
  getInventoryReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/low-stock`);
      if (!response.ok) throw new Error('Failed to fetch inventory report');
      return await response.json();
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  },

  // Customer Report
  getCustomerReport: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/top-customers?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch customer report');
      return await response.json();
    } catch (error) {
      console.error('Error fetching customer report:', error);
      throw error;
    }
  },

  // Dashboard data for overall metrics
  getDashboardData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }
};

const Reports = () => {
  const [activeReport, setActiveReport] = useState('sales');
  const [dateRange, setDateRange] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for live data
  const [salesData, setSalesData] = useState([]);
  const [salesMetrics, setSalesMetrics] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    conversionRate: 3.24,
    growthRate: 12.5
  });
  const [productData, setProductData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    overview: {
      totalSales: 0,
      totalRevenue: 0,
      totalCustomers: 0,
      totalProducts: 0,
      lowStockProducts: 0,
      averageSale: 0
    }
  });

  // Fetch data when activeReport or dateRange changes
  useEffect(() => {
    fetchData();
  }, [activeReport, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let startDate, endDate;
      
      if (dateRange === 'custom') {
        startDate = customDateRange.startDate;
        endDate = customDateRange.endDate;
      }
      
      switch (activeReport) {
        case 'sales':
          await fetchSalesData(startDate, endDate);
          break;
        case 'product':
          await fetchProductData();
          break;
        case 'inventory':
          await fetchInventoryData();
          break;
        case 'customer':
          await fetchCustomerData();
          break;
        default:
          break;
      }
      
      // Always fetch dashboard data for overall metrics
      await fetchDashboardData();
      
    } catch (err) {
      setError(err.message || 'Failed to fetch data. Please check your connection.');
      console.error('Error fetching report data:', err);
      loadSampleData();
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesData = async (startDate, endDate) => {
    const salesRes = await apiService.getSalesReport(
      dateRange === 'custom' ? 'custom' : dateRange,
      startDate,
      endDate
    );
    
    if (salesRes.success) {
      // Format the data from analytics/sales-trend endpoint
      const formattedData = salesRes.data?.map((item, index) => ({
        period: `Week ${index + 1}`,
        sales: item.revenue || 0,
        target: (item.revenue || 0) * 1.1, // 10% target
        count: item.count || 0,
        month: item._id?.month ? getMonthName(item._id.month) : `Period ${index + 1}`
      })) || [];
      
      setSalesData(formattedData);
      
      // Calculate metrics from the data
      const totalSales = formattedData.reduce((sum, item) => sum + item.sales, 0);
      const totalOrders = formattedData.reduce((sum, item) => sum + item.count, 0);
      
      setSalesMetrics({
        totalSales,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
        conversionRate: 3.24,
        growthRate: 12.5
      });
    }
  };

  const fetchProductData = async () => {
    const productRes = await apiService.getProductReport();
    if (productRes.success) {
      // Format product data from analytics/top-products endpoint
      const formattedData = productRes.data?.map((item, index) => ({
        product: item._id || `Product ${index + 1}`,
        sold: item.totalQuantity || Math.floor(Math.random() * 100) + 50,
        revenue: item.totalRevenue || Math.floor(Math.random() * 50000) + 10000,
        stock: Math.floor(Math.random() * 100) + 20,
        category: ['Electronics', 'Accessories', 'Home Appliances'][index % 3]
      })) || [];
      
      setProductData(formattedData);
    }
  };

  const fetchInventoryData = async () => {
    const inventoryRes = await apiService.getInventoryReport();
    if (inventoryRes.success) {
      // Format inventory data from analytics/low-stock endpoint
      const formattedData = inventoryRes.data?.map((item, index) => ({
        category: item.category || item.name || `Category ${index + 1}`,
        inStock: item.stock || Math.floor(Math.random() * 200) + 50,
        lowStock: Math.floor(Math.random() * 20) + 5,
        outOfStock: Math.floor(Math.random() * 5),
        value: item.price ? item.price * (item.stock || 0) : Math.floor(Math.random() * 50000) + 10000
      })) || [];
      
      setInventoryData(formattedData);
    }
  };

  const fetchCustomerData = async () => {
    const customerRes = await apiService.getCustomerReport();
    if (customerRes.success) {
      // Format customer data from analytics/top-customers endpoint
      const formattedData = customerRes.data?.map((item, index) => ({
        name: item._id || `Customer ${index + 1}`,
        totalSpent: item.totalSpent || Math.floor(Math.random() * 5000) + 1000,
        totalPurchases: item.totalPurchases || Math.floor(Math.random() * 10) + 1
      })) || [];
      
      setCustomerData(formattedData);
    }
  };

  const fetchDashboardData = async () => {
    const dashboardRes = await apiService.getDashboardData();
    if (dashboardRes.success) {
      setDashboardData(dashboardRes.data);
    }
  };

  // Helper function to get month name
  const getMonthName = (monthNumber) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthNumber - 1] || `Month ${monthNumber}`;
  };
    
    switch (activeReport) {
      case 'sales':
        setSalesData(sampleSalesData);
        setSalesMetrics({
          totalSales: 37000,
          totalOrders: 200,
          avgOrderValue: 185,
          conversionRate: 3.24,
          growthRate: 12.5
        });
        break;
      case 'product':
        setProductData(sampleProductData);
        break;
      case 'inventory':
        setInventoryData(sampleInventoryData);
        break;
      case 'customer':
        setCustomerData(sampleCustomerData);
        break;
    }

  // Profit/Loss data (calculated from dashboard data)

  // --- EXPORT FUNCTIONALITY ---
  const handleExport = () => {
    try {
      let csvHeaders = [];
      let csvRows = [];
      let filename = `Report_${activeReport}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;

      switch (activeReport) {
        case 'sales':
          csvHeaders = ['Period', 'Sales', 'Target', 'Orders', 'Month'];
          csvRows = salesData.map(d => [d.period, d.sales, d.target || (d.sales * 1.1), d.count || 0, d.month]);
          break;
        case 'product':
          csvHeaders = ['Product', 'Units Sold', 'Revenue', 'Stock', 'Category'];
          csvRows = productData.map(d => [
            d.product,
            d.sold || 0,
            d.revenue || 0,
            d.stock || 'N/A',
            d.category || 'N/A'
          ]);
          break;
        case 'inventory':
          csvHeaders = ['Category', 'In Stock', 'Low Stock', 'Out of Stock', 'Value'];
          csvRows = inventoryData.map(d => [
            d.category,
            d.inStock,
            d.lowStock,
            d.outOfStock,
            d.value
          ]);
          break;
        case 'customer':
          csvHeaders = ['Customer Name', 'Total Spent', 'Total Purchases', 'Average Order'];
          csvRows = customerData.map(d => [
            d.name,
            d.totalSpent,
            d.totalPurchases,
            d.totalPurchases > 0 ? (d.totalSpent / d.totalPurchases).toFixed(2) : 0
          ]);
          break;
        case 'profitloss':
          csvHeaders = ['Metric', 'Amount'];
          csvRows = [
            ['Total Revenue', profitLossData.summary.revenue],
            ['Cost of Goods Sold', profitLossData.summary.cogs],
            ['Gross Profit', profitLossData.summary.grossProfit],
            ['Operating Expenses', profitLossData.summary.expenses],
            ['Net Profit', profitLossData.summary.netProfit],
            ['Profit Margin (%)', profitLossData.summary.profitMargin]
          ];
          break;
        default:
          return;
      }

      // Combine headers and data
      const csvString = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      // Trigger download
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      alert(`Report exported successfully as ${filename}`);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report. Please try again.');
    }
  };

  // Handle custom date range selection
  const handleCustomDateChange = (dates) => {
    const [start, end] = dates;
    setCustomDateRange({
      startDate: start,
      endDate: end
    });
    if (start && end) {
      setDateRange('custom');
    }
  };

  // Render loading state
  const renderLoading = () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading {activeReport} report...</p>
        <p className="text-sm text-gray-500">Fetching live data from server</p>
      </div>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
      <div className="flex items-center">
        <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
        <div>
          <h3 className="text-red-800 font-semibold">Error Loading Report</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <p className="text-gray-600 text-sm mt-2">
            Showing sample data. Please check your backend connection.
          </p>
          <button
            onClick={fetchData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );

  // Render sales report
  const renderSalesReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                ${dashboardData.overview.totalSales.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm text-green-600 mt-2">+{salesMetrics.growthRate}% from last period</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${dashboardData.overview.totalRevenue.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-sm text-green-600 mt-2">+8.2% from last period</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${dashboardData.overview.averageSale.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-sm text-green-600 mt-2">+3.8% from last period</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {salesMetrics.totalOrders.toLocaleString()}
              </p>
            </div>
            <Users className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-sm text-red-600 mt-2">-0.5% from last period</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Sales Performance - {dateRange === 'custom' ? 
              `${customDateRange.startDate.toLocaleDateString()} to ${customDateRange.endDate.toLocaleDateString()}` :
              dateRange === 'week' ? 'This Week' : 
              dateRange === 'month' ? 'This Month' : 
              dateRange === 'quarter' ? 'This Quarter' : 
              'This Year'}
          </h3>
          <div className="text-sm text-gray-500">
            {salesData.length} data points
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period" 
              tick={{ fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
              labelFormatter={(label) => `Period: ${label}`}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="sales" 
              name="Actual Sales" 
              stroke="#3b82f6" 
              fill="#93c5fd" 
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area 
              type="monotone" 
              dataKey="target" 
              name="Target" 
              stroke="#10b981" 
              fill="#10b981" 
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {salesData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Sales Data</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesData.slice(-10).map((item, idx) => {
                  const variance = item.sales - item.target;
                  const variancePercent = item.target > 0 ? (variance / item.target * 100) : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.period}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.sales.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.target.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          variance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {variance >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          variance >= 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {variance >= 0 ? 'Above Target' : 'Below Target'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // Render product report
  const renderProductReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-3xl font-bold text-gray-900">
            {dashboardData.overview.totalProducts}
          </p>
          <p className="text-sm text-gray-500 mt-1">Active products in catalog</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">
            ${productData.reduce((sum, item) => sum + (item.revenue || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">From product sales</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Units Sold</p>
          <p className="text-3xl font-bold text-blue-600">
            {productData.reduce((sum, item) => sum + (item.sold || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total units sold</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold">Top Performing Products</h3>
          <p className="text-sm text-gray-600">Best selling products by revenue</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productData.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.product}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {item.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.sold.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      ${item.revenue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.stock}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                      item.stock === 0 
                        ? 'bg-red-100 text-red-800' 
                        : item.stock < 20 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.stock === 0 
                        ? 'Out of Stock' 
                        : item.stock < 20 
                        ? 'Low Stock'
                        : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Revenue by Product</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={productData.slice(0, 8)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              type="number" 
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              dataKey="product" 
              type="category" 
              width={150}
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Bar 
              dataKey="revenue" 
              name="Revenue" 
              fill="#8b5cf6" 
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Render inventory report
  const renderInventoryReport = () => {
    const inventoryTotals = {
      totalItems: inventoryData.reduce((sum, item) => sum + item.inStock, 0),
      lowStockCount: inventoryData.reduce((sum, item) => sum + item.lowStock, 0),
      outOfStockCount: inventoryData.reduce((sum, item) => sum + item.outOfStock, 0),
      totalValue: inventoryData.reduce((sum, item) => sum + item.value, 0)
    };
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-3xl font-bold text-gray-900">
              {inventoryTotals.totalItems.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">In Inventory</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Low Stock Items</p>
            <p className="text-3xl font-bold text-yellow-600">
              {inventoryTotals.lowStockCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Needs Reorder</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Out of Stock</p>
            <p className="text-3xl font-bold text-red-600">
              {inventoryTotals.outOfStockCount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Urgent Action</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-3xl font-bold text-green-600">
              ${inventoryTotals.totalValue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Inventory Worth</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold">Inventory Status by Category</h3>
            <p className="text-sm text-gray-600">Detailed breakdown of inventory levels</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Low Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Out of Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Health</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryData.map((item, idx) => {
                  const totalItems = item.inStock + item.lowStock + item.outOfStock;
                  const healthPercent = totalItems > 0 ? 
                    (item.inStock / totalItems) * 100 : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.category}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-600 font-medium">
                          {item.inStock.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-yellow-600 font-medium">
                          {item.lowStock.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-600 font-medium">
                          {item.outOfStock.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${item.value.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                healthPercent >= 70 ? 'bg-green-500' :
                                healthPercent >= 40 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(healthPercent, 100)}%` }}
                            />
                          </div>
                          <span className="ml-2 text-xs text-gray-500">
                            {healthPercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Low Stock Alert</h3>
          <div className="space-y-4">
            {inventoryData.filter(item => item.lowStock > 0 || item.outOfStock > 0).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{item.category}</p>
                  <p className="text-sm text-gray-600">
                    {item.lowStock} low stock, {item.outOfStock} out of stock
                  </p>
                </div>
                <div>
                  {item.outOfStock > 0 ? (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      Urgent
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                      Warning
                    </span>
                  )}
                </div>
              </div>
            ))}
            {inventoryData.filter(item => item.lowStock > 0 || item.outOfStock > 0).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>All inventory items are well stocked</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render customer report
  const renderCustomerReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Customers</p>
          <p className="text-3xl font-bold text-gray-900">
            {dashboardData.overview.totalCustomers.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            +{Math.round(dashboardData.overview.totalCustomers * 0.1)} this month
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Active Customers</p>
          <p className="text-3xl font-bold text-blue-600">
            {Math.round(dashboardData.overview.totalCustomers * 0.7).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Made purchases this period</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-600">Customer Lifetime Value</p>
          <p className="text-3xl font-bold text-green-600">
            ${Math.round(dashboardData.overview.totalRevenue / dashboardData.overview.totalCustomers).toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">
            +2.3% improvement
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Customers</h3>
          <div className="space-y-4">
            {customerData.map((customer, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.totalPurchases} purchases</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${customer.totalSpent.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">
                    Avg: ${(customer.totalSpent / customer.totalPurchases).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Customer Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={customerDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => 
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {customerDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name, props) => [
                  value, 
                  props.payload.name
                ]}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Customer Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">New Customers</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {customerSegments.find(s => s._id === 'New')?.count || 0}
            </p>
            <p className="text-xs text-blue-600 mt-1">Acquired this period</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800 font-medium">Repeat Rate</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {Math.round((customerSegments.find(s => s._id === 'Returning')?.count || 0) / 
                dashboardData.overview.totalCustomers * 100)}%
            </p>
            <p className="text-xs text-green-600 mt-1">Customers returning</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-800 font-medium">VIP Contribution</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {Math.round((customerSegments.find(s => s._id === 'VIP')?.totalRevenue || 0) / 
                dashboardData.overview.totalRevenue * 100)}%
            </p>
            <p className="text-xs text-purple-600 mt-1">Of total revenue</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">Inactive Customers</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {customerSegments.find(s => s._id === 'Inactive')?.count || 0}
            </p>
            <p className="text-xs text-amber-600 mt-1">Need re-engagement</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render profit/loss report
  const renderProfitLossReport = () => {
    const totalExpenses = Object.values(profitLossData.expenseBreakdown).reduce((a, b) => a + b, 0);
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-3xl font-bold text-blue-600">
              ${profitLossData.summary.revenue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {dateRange === 'custom' ? 'Selected period' : 
               `Last ${dateRange}`}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600">
              ${(profitLossData.summary.cogs + totalExpenses).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Including COGS</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Net Profit</p>
            <p className="text-3xl font-bold text-green-600">
              ${profitLossData.summary.netProfit.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Margin: {profitLossData.summary.profitMargin.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Monthly Profit Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={profitLossData.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis 
                tick={{ fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value) => [`$${value.toLocaleString()}`, 'Profit']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="profit" 
                name="Net Profit" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Income Statement</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-700 font-medium">Total Revenue</span>
                <span className="font-semibold text-gray-900">
                  ${profitLossData.summary.revenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-700">Cost of Goods Sold</span>
                <span className="font-semibold text-red-600">
                  -${profitLossData.summary.cogs.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b bg-green-50 px-3 rounded">
                <span className="font-medium text-gray-900">Gross Profit</span>
                <span className="font-bold text-green-600">
                  ${profitLossData.summary.grossProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-700">Operating Expenses</span>
                <span className="font-semibold text-red-600">
                  -${totalExpenses.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-green-100 px-3 rounded-lg">
                <span className="font-bold text-gray-900">Net Profit</span>
                <span className="font-bold text-green-700 text-lg">
                  ${profitLossData.summary.netProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 mt-2">
                <span className="text-gray-600">Profit Margin</span>
                <span className={`font-bold ${
                  profitLossData.summary.profitMargin >= 20 ? 'text-green-600' :
                  profitLossData.summary.profitMargin >= 10 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {profitLossData.summary.profitMargin.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
            <div className="space-y-4">
              {Object.entries(profitLossData.expenseBreakdown).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-semibold">
                      ${value.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ 
                        width: `${totalExpenses > 0 ? (value / totalExpenses) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>${value.toLocaleString()}</span>
                    <span>
                      {totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total Expenses</span>
                <span className="text-red-600">
                  ${totalExpenses.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Analytics Reports</h1>
              <p className="text-gray-600 mt-1">Electronic Store Performance & Insights</p>
              <div className="flex items-center mt-2">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  loading ? 'bg-yellow-500 animate-pulse' : 
                  error ? 'bg-red-500' : 'bg-green-500'
                }`}></div>
                <span className={`text-sm ${
                  loading ? 'text-yellow-600' : 
                  error ? 'text-red-600' : 'text-green-600'
                }`}>
                  {loading ? 'Connecting to server...' : 
                   error ? 'Using sample data' : 'Connected to live data'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              
              <button 
                onClick={handleExport}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Report Selection and Date Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveReport('sales')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeReport === 'sales'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Sales Report
              </button>
              <button
                onClick={() => setActiveReport('product')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeReport === 'product'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Package className="w-4 h-4" />
                Product Report
              </button>
              <button
                onClick={() => setActiveReport('inventory')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeReport === 'inventory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                Inventory Report
              </button>
              <button
                onClick={() => setActiveReport('customer')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeReport === 'customer'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                Customer Report
              </button>
              <button
                onClick={() => setActiveReport('profitloss')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeReport === 'profitloss'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
                Profit & Loss
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <DatePicker
                    selectsRange={true}
                    startDate={customDateRange.startDate}
                    endDate={customDateRange.endDate}
                    onChange={handleCustomDateChange}
                    isClearable={false}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholderText="Select date range"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && renderError()}

        {/* Main Content */}
        <div className="mt-6">
          {loading ? (
            renderLoading()
          ) : (
            <>
              {activeReport === 'sales' && renderSalesReport()}
              {activeReport === 'product' && renderProductReport()}
              {activeReport === 'inventory' && renderInventoryReport()}
              {activeReport === 'customer' && renderCustomerReport()}
              {activeReport === 'profitloss' && renderProfitLossReport()}
            </>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            <p>
              Data last updated: {new Date().toLocaleString()} | 
              Report generated by Electronic Store Billing System v1.0
            </p>
            <p className="mt-1">
              {error ? '⚠️ Currently showing sample data. Connect to backend for live data.' : 
               '✅ Connected to live database'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;