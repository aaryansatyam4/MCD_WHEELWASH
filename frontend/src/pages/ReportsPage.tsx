import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Table,
  Clock,
  Truck,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { reportService, dashboardService } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.js';

export const ReportsPage: React.FC = () => {
  const { user, isOperator } = useAuth();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [locations, setLocations] = useState<any[]>([]);

  // Load locations for filter dropdown
  useEffect(() => {
    dashboardService.getLocations().then((res) => {
      setLocations(res.locations || []);
      if (isOperator && user?.assigned_location_id) {
        setSelectedLocation(String(user.assigned_location_id));
      }
    });
  }, [isOperator, user]);

  // Fetch report data
  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const locId = selectedLocation !== 'all' ? Number(selectedLocation) : undefined;

      let data: any;
      if (reportType === 'daily') {
        const dateStr = dateFilter === 'yesterday'
          ? (() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              return d.toISOString().split('T')[0];
            })()
          : customStart;
        data = await reportService.getDaily(dateStr, locId);
      } else if (reportType === 'weekly') {
        data = await reportService.getWeekly(customStart, customEnd, locId);
      } else if (reportType === 'monthly') {
        const ym = customStart.slice(0, 7); // YYYY-MM
        data = await reportService.getMonthly(ym, locId);
      } else if (reportType === 'yearly') {
        const y = customStart.slice(0, 4); // YYYY
        data = await reportService.getYearly(y, locId);
      }

      setReportData(data);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, dateFilter, customStart, customEnd, selectedLocation]);

  // Export handlers
  const handleExport = (format: 'csv' | 'excel') => {
    const locId = selectedLocation !== 'all' ? Number(selectedLocation) : undefined;
    const url = reportService.downloadExport({
      format,
      type: reportType,
      date: customStart,
      startDate: customStart,
      endDate: customEnd,
      month: customStart.slice(0, 7),
      year: customStart.slice(0, 4),
      locationId: locId,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Operational Reports & Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Historical vehicle movements, daily/weekly/monthly trends, approved audit corrections, and official exports (Asia/Kolkata)
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Report Type Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-colors ${
                reportType === t
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t} Report
            </button>
          ))}
        </div>

        {/* Date and Location Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Date Presets */}
          <select
            value={dateFilter}
            onChange={(e) => {
              const val = e.target.value;
              setDateFilter(val);
              const now = new Date();
              if (val === 'today') {
                setCustomStart(now.toISOString().split('T')[0]);
                setCustomEnd(now.toISOString().split('T')[0]);
              } else if (val === 'yesterday') {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                const yStr = y.toISOString().split('T')[0];
                setCustomStart(yStr);
                setCustomEnd(yStr);
              } else if (val === 'last7days') {
                const p = new Date(now);
                p.setDate(p.getDate() - 6);
                setCustomStart(p.toISOString().split('T')[0]);
                setCustomEnd(now.toISOString().split('T')[0]);
              }
            }}
            className="text-xs rounded-lg border-slate-300 border px-3 py-1.5 bg-slate-50 font-medium focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {/* Date Picker Input */}
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="text-xs rounded-lg border-slate-300 border px-2.5 py-1.5 bg-white font-mono focus:outline-none"
          />

          {reportType === 'weekly' && (
            <>
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs rounded-lg border-slate-300 border px-2.5 py-1.5 bg-white font-mono focus:outline-none"
              />
            </>
          )}

          {/* Location Selector (Disabled for Operator) */}
          <select
            value={selectedLocation}
            disabled={isOperator}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs rounded-lg border-slate-300 border px-3 py-1.5 bg-slate-50 font-medium focus:outline-none disabled:opacity-60"
          >
            {!isOperator && <option value="all">All Locations (Combined)</option>}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchReport}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Vehicle Passages</span>
            <div className="text-3xl font-black text-slate-900 font-mono mt-1">
              {(reportData.totalTrucks || reportData.grandTotal || reportData.combinedAnnualCount || 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
              Reflects approved manual corrections
            </span>
          </div>

          {reportData.averageDailyCount !== undefined && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase">Average Daily Movement</span>
              <div className="text-3xl font-black text-blue-600 font-mono mt-1">
                {reportData.averageDailyCount}
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                Trucks per 24-hour operational day
              </span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Operating Timezone</span>
            <div className="text-xl font-black text-slate-800 font-mono mt-2">
              Asia/Kolkata (IST)
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
              Standard MCD Reporting Windows
            </span>
          </div>
        </div>
      )}

      {/* Visual Analytics Chart */}
      {reportData && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 mb-4 uppercase tracking-wide">
            {reportType === 'daily'
              ? '24-Hour Movement Profile'
              : reportType === 'weekly'
              ? '7-Day Comparative Movement'
              : reportType === 'monthly'
              ? 'Daily Passages Across Month'
              : 'Annual Monthly Profile (Jan - Dec)'}
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {reportType === 'daily' ? (
                <BarChart data={reportData.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} interval={2} />
                  <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px' }} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Trucks" />
                </BarChart>
              ) : reportType === 'weekly' || reportType === 'monthly' ? (
                <BarChart data={reportData.dailyBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                  <Bar dataKey="ghazipur" name="Ghazipur" fill="#3B82F6" stackId="a" />
                  <Bar dataKey="okhla" name="Okhla" fill="#10B981" stackId="a" />
                  <Bar dataKey="bhalaswa" name="Bhalaswa" fill="#F59E0B" stackId="a" />
                </BarChart>
              ) : (
                <BarChart data={reportData.monthlyBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                  <Bar dataKey="ghazipur" name="Ghazipur" fill="#3B82F6" stackId="a" />
                  <Bar dataKey="okhla" name="Okhla" fill="#10B981" stackId="a" />
                  <Bar dataKey="bhalaswa" name="Bhalaswa" fill="#F59E0B" stackId="a" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Location Breakdown Table */}
      {reportData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Table className="w-4 h-4 text-blue-600" />
              Location Performance Breakdown
            </h3>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase">Location</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600 uppercase">Verified Camera Passages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(reportData.locations || reportData.locationTotals || []).map((loc: any) => (
                <tr key={loc.locationId} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-800 font-sans font-bold">{loc.locationName}</td>
                  <td className="px-5 py-3 text-right text-slate-900 font-black text-sm">{loc.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual Truck Passage Timings Log */}
      {reportData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Truck Passage Timings Log
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Exact passage timestamps recorded when verified heavy trucks traversed the wheel-wash bay (Asia/Kolkata)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold self-start sm:self-auto font-mono">
              <Truck className="w-3.5 h-3.5" />
              <span>{reportData.vehiclePassages?.length || 0} Verified Crossings</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Passage #</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Crossing Time (IST)</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Classification</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Detection Source</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600 uppercase tracking-wider">Wash Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {reportData.vehiclePassages && reportData.vehiclePassages.length > 0 ? (
                  reportData.vehiclePassages.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-bold">
                        #{p.passageNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-black">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3 text-blue-600" />
                          {p.time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {p.date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-sans font-bold text-[11px] ${
                            p.locationName?.toUpperCase() === 'GHAZIPUR'
                              ? 'bg-blue-100 text-blue-800'
                              : p.locationName?.toUpperCase() === 'OKHLA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.locationName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-sans font-semibold">
                        {p.vehicleType || 'Heavy Commercial Truck'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-sans">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                          {p.detectionSource || 'Live CCTV AI'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {p.status || 'WASHED & RECORDED'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                      <p className="font-semibold text-slate-600">No truck passages recorded for this period.</p>
                      <p className="text-xs text-slate-400 mt-1">Crossings will automatically appear here as trucks pass through the wheel-wash.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
