import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { PublisherSupplyAnalysis, CapacityStatus } from '../types';
import { formatNumber, formatCurrency } from '../lib/dataProcessor';

interface SupplyTrendPanelProps {
  analysis: PublisherSupplyAnalysis[];
}

const STATUS_CONFIG: Record<CapacityStatus, { label: string; badge: string; row: string; dot: string }> = {
  over:     { label: 'Over Capacity',       badge: 'bg-rose-100 text-rose-700 border border-rose-200',    row: 'bg-rose-50/40',    dot: 'bg-rose-500' },
  inline:   { label: 'In-line with Capacity', badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', row: 'bg-emerald-50/30', dot: 'bg-emerald-500' },
  under:    { label: 'Under Capacity',      badge: 'bg-amber-100 text-amber-700 border border-amber-200', row: 'bg-amber-50/30',   dot: 'bg-amber-500' },
  'no-data':{ label: 'No Supply Data',      badge: 'bg-slate-100 text-slate-500 border border-slate-200', row: '',                  dot: 'bg-slate-300' },
};

const tooltipStyle = {
  borderRadius: '12px', border: 'none',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px',
};

type SortKey = keyof PublisherSupplyAnalysis;

export const SupplyTrendPanel: React.FC<SupplyTrendPanelProps> = ({ analysis }) => {
  const [search, setSearch]     = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CapacityStatus | 'all'>('all');
  const [sort, setSort]         = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'capacityAbsolute', dir: 'desc' });

  // ── Status counts ─────────────────────────────────────────────────────────
  const counts = React.useMemo(() => {
    const c = { over: 0, inline: 0, under: 0, 'no-data': 0 };
    analysis.forEach(a => { c[a.status]++; });
    return c;
  }, [analysis]);

  const total = analysis.length;

  // ── Filtered + sorted table data ─────────────────────────────────────────
  const tableData = React.useMemo(() => {
    const q = search.toLowerCase();
    let result = analysis.filter(a => {
      const matchSearch = !q ||
        a.publisherName.toLowerCase().includes(q) ||
        a.publisherId.toLowerCase().includes(q) ||
        a.csm.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });

    result = [...result].sort((a, b) => {
      const av = (a as any)[sort.key];
      const bv = (b as any)[sort.key];
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });

    return result;
  }, [analysis, search, statusFilter, sort]);


  // ── Chart data: top 15 publishers by capacity ────────────────────────────
  const chartData = React.useMemo(() =>
    [...analysis]
      .filter(a => a.avgDailySupply > 0 || a.capacityAbsolute > 0)
      .sort((a, b) => b.capacityAbsolute - a.capacityAbsolute)
      .slice(0, 15)
      .map(a => ({
        name: a.publisherName.length > 14 ? a.publisherName.slice(0, 12) + '…' : a.publisherName,
        capacity: a.capacityAbsolute,
        supply: a.avgDailySupply,
        status: a.status,
      })),
    [analysis]);

  const handleSort = (key: SortKey) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sort.key !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sort.dir === 'desc'
      ? <ArrowDown className="w-3 h-3 text-indigo-500" />
      : <ArrowUp className="w-3 h-3 text-indigo-500" />;
  };

  const thC = 'px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap';
  const thS = 'px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap';

  const supplyWithData = analysis.filter(a => a.status !== 'no-data');

  // ── Status card click toggles filter ────────────────────────────────────
  const toggleStatus = (s: CapacityStatus) =>
    setStatusFilter(prev => prev === s ? 'all' : s);

  return (
    <div className="space-y-6">

      {/* ── Status Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {((['over', 'inline', 'under', 'no-data'] as CapacityStatus[])).map(s => {
          const cfg   = STATUS_CONFIG[s];
          const count = counts[s];
          const pct   = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
          const active = statusFilter === s;
          const Icon  = s === 'over' ? TrendingUp : s === 'inline' ? Activity : s === 'under' ? TrendingDown : Minus;
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`bg-white p-5 rounded-2xl border text-left transition-all ${
                active ? 'border-indigo-400 shadow-md ring-2 ring-indigo-200' : 'border-slate-100 shadow-sm hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <Icon className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-3xl font-mono font-medium text-slate-900 tabular-nums">{count}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-1">{pct}% of publishers</p>
            </button>
          );
        })}
      </div>

      {/* ── Chart: Capacity vs Avg Daily Supply ─────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-900 mb-1">Capacity vs Avg Daily Supply (Top 15)</h3>
          <p className="text-xs text-slate-400 mb-5">
            Approved daily capacity compared against the 7-day average supply volume.
            {supplyWithData.length < analysis.length && (
              <span className="ml-2 text-amber-600 font-semibold">
                {analysis.length - supplyWithData.length} publisher{analysis.length - supplyWithData.length !== 1 ? 's' : ''} have no supply data.
              </span>
            )}
          </p>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name" angle={-40} textAnchor="end" interval={0}
                  tick={{ fontSize: 11, fill: '#64748b' }} stroke="#e2e8f0"
                />
                <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#e2e8f0" />
                <Tooltip
                  formatter={(val: number, name: string) => [formatNumber(val), name === 'Approved Capacity' ? 'Approved Capacity' : 'Avg Daily Supply']}
                  contentStyle={tooltipStyle}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="capacity" name="Approved Capacity" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="supply" name="Avg Daily Supply" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={
                        entry.status === 'over'   ? '#f43f5e' :
                        entry.status === 'inline' ? '#10b981' :
                        entry.status === 'under'  ? '#f59e0b' : '#94a3b8'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Table header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Publisher Supply Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5">{tableData.length} publisher{tableData.length !== 1 ? 's' : ''} {statusFilter !== 'all' ? `· filtered: ${STATUS_CONFIG[statusFilter].label}` : ''}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter pills */}
            <div className="flex items-center gap-1.5">
              {(['all', 'over', 'inline', 'under'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    statusFilter === s
                      ? s === 'all'    ? 'bg-indigo-600 text-white'
                      : s === 'over'   ? 'bg-rose-500 text-white'
                      : s === 'inline' ? 'bg-emerald-500 text-white'
                      :                  'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search publishers, CSM..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-4 text-[10px] font-mono font-bold text-slate-400">
          <span>STATUS:</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Over Capacity (&gt;100%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> In-line (70–100%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Under Capacity (&lt;70%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /> No Supply Data</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200">
                <th className={thC} onClick={() => handleSort('publisherId')}>
                  <div className="flex items-center gap-1.5">PUB ID <SortIcon k="publisherId" /></div>
                </th>
                <th className={thC} onClick={() => handleSort('publisherName')}>
                  <div className="flex items-center gap-1.5">PUBLISHER <SortIcon k="publisherName" /></div>
                </th>
                <th className={thS}>REGION</th>
                <th className={thS}>CSM</th>
                <th className={thC} onClick={() => handleSort('capacityAbsolute')}>
                  <div className="flex items-center gap-1.5">DAILY CAPACITY <SortIcon k="capacityAbsolute" /></div>
                </th>
                <th className={thC} onClick={() => handleSort('avgDailySupply')}>
                  <div className="flex items-center gap-1.5">AVG DAILY SUPPLY (7D) <SortIcon k="avgDailySupply" /></div>
                </th>
                <th className={thC} onClick={() => handleSort('supplyPct')}>
                  <div className="flex items-center gap-1.5">SUPPLY % <SortIcon k="supplyPct" /></div>
                </th>
                <th className={thC} onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">STATUS <SortIcon k="status" /></div>
                </th>
                <th className={thC} onClick={() => handleSort('avgGeCPM')}>
                  <div className="flex items-center gap-1.5">AVG geCPM (7D) <SortIcon k="avgGeCPM" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map(row => {
                const cfg = STATUS_CONFIG[row.status];
                return (
                  <tr key={row.publisherId} className={`hover:brightness-95 transition-all ${cfg.row}`}>
                    <td className="px-2 py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px] border border-slate-200 whitespace-nowrap">
                        {row.publisherId}
                      </span>
                    </td>
                    {/* Publisher: capped width + truncate */}
                    <td className="px-2 py-2.5 w-36 max-w-[9rem]">
                      <p className="text-xs font-semibold text-slate-900 truncate" title={row.publisherName}>
                        {row.publisherName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{row.integrationType}</p>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{row.dataCenter}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{row.csm}</td>
                    <td className="px-2 py-2.5 text-xs font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {formatNumber(row.capacityAbsolute)}
                    </td>
                    <td className="px-2 py-2.5 text-xs font-mono font-semibold tabular-nums whitespace-nowrap">
                      {row.avgDailySupply > 0
                        ? <span className="text-slate-700">{formatNumber(row.avgDailySupply)}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {row.avgDailySupply > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.status === 'over'   ? 'bg-rose-500' :
                                row.status === 'inline' ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                              style={{ width: `${Math.min(row.supplyPct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-mono font-bold tabular-nums ${
                            row.status === 'over'   ? 'text-rose-600' :
                            row.status === 'inline' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {row.supplyPct.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-xs font-mono font-semibold tabular-nums whitespace-nowrap">
                      {row.avgGeCPM > 0
                        ? <span className="text-slate-700">{formatCurrency(row.avgGeCPM)}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tableData.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">No publishers match your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
