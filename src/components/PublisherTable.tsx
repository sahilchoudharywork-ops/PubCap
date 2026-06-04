import React from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PublisherData } from '../types';
import { formatNumber } from '../lib/dataProcessor';

interface PublisherTableProps {
  data: PublisherData[];
  previousData: PublisherData[];
}

type SortKey = keyof PublisherData | 'change' | 'changeAbs';

export const PublisherTable: React.FC<PublisherTableProps> = ({ data, previousData }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const hasComparison = previousData.length > 0;

  const tableData = React.useMemo(() => {
    return data.map(curr => {
      const prev = previousData.find(p => p.publisherId === curr.publisherId);
      const changeAbs = prev ? curr.capacityAbsolute - prev.capacityAbsolute : 0;
      const change = prev && prev.capacityAbsolute > 0 ? (changeAbs / prev.capacityAbsolute) * 100 : 0;
      const isNew = !prev && hasComparison;
      return { ...curr, change, changeAbs, isNew };
    });
  }, [data, previousData, hasComparison]);

  const filteredData = React.useMemo(() => {
    const q = searchTerm.toLowerCase();
    let result = tableData.filter(
      d =>
        d.publisherName.toLowerCase().includes(q) ||
        d.publisherId.toLowerCase().includes(q) ||
        d.csm.toLowerCase().includes(q) ||
        d.csom.toLowerCase().includes(q)
    );
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = (a as any)[sortConfig.key];
        const bVal = (b as any)[sortConfig.key];
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal) * dir;
        return ((aVal ?? 0) - (bVal ?? 0)) * dir;
      });
    }
    return result;
  }, [tableData, searchTerm, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortConfig?.key !== colKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'desc'
      ? <ArrowDown className="w-3 h-3 text-indigo-500" />
      : <ArrowUp className="w-3 h-3 text-indigo-500" />;
  };

  const getRowClass = (change: number, isNew: boolean) => {
    if (isNew) return 'bg-indigo-50/40';
    if (change > 20) return 'bg-emerald-50/40';
    if (change < -20) return 'bg-rose-50/40';
    return '';
  };

  const getChangeBadge = (change: number, changeAbs: number, isNew: boolean) => {
    if (isNew)
      return <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">NEW</span>;
    if (!hasComparison || (change === 0 && changeAbs === 0))
      return <span className="text-[11px] font-mono text-slate-300">—</span>;
    const cls = change > 0
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-rose-50 text-rose-700 border border-rose-200';
    return (
      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${cls}`}>
        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  // Compact th classes — tighter padding, smaller text
  const thC = 'px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap';
  const thS = 'px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Publisher Details</h3>
          <p className="text-xs text-slate-400 mt-0.5">{filteredData.length} publisher{filteredData.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, ID, CSM…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm"
          />
        </div>
      </div>

      {/* Legend */}
      {hasComparison && (
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-4 text-[10px] font-mono font-bold text-slate-400">
          <span>LEGEND:</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200" /> +20%+ increase</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" /> −20%+ decrease</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200" /> New this quarter</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-200">
              <th className={thC} onClick={() => handleSort('publisherId')}>
                <div className="flex items-center gap-1">PUB ID <SortIcon colKey="publisherId" /></div>
              </th>
              {/* Publisher column: fixed narrower width */}
              <th className={`${thC} w-36`} onClick={() => handleSort('publisherName')}>
                <div className="flex items-center gap-1">PUBLISHER <SortIcon colKey="publisherName" /></div>
              </th>
              <th className={thS}>REGION</th>
              <th className={thS}>CSM</th>
              <th className={thS}>CSOM</th>
              <th className={thC} onClick={() => handleSort('capacityAbsolute')}>
                <div className="flex items-center gap-1">CAPACITY <SortIcon colKey="capacityAbsolute" /></div>
              </th>
              {['EAST', 'WEST', 'EMEA', 'APAC', 'JPAC'].map(dc => (
                <th key={dc} className={thS}>{dc}</th>
              ))}
              {hasComparison && (
                <>
                  <th className={thC} onClick={() => handleSort('changeAbs')}>
                    <div className="flex items-center gap-1">Δ ABS <SortIcon colKey="changeAbs" /></div>
                  </th>
                  <th className={thC} onClick={() => handleSort('change')}>
                    <div className="flex items-center gap-1">Δ % <SortIcon colKey="change" /></div>
                  </th>
                </>
              )}
              <th className={thS}>INTEGRATION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map(pub => (
              <tr
                key={pub.publisherId}
                className={`hover:brightness-95 transition-all ${getRowClass(pub.change, pub.isNew)}`}
              >
                <td className="px-2 py-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px] border border-slate-200 whitespace-nowrap">
                    {pub.publisherId}
                  </span>
                </td>
                {/* Publisher: capped width + truncate to prevent column from blowing out */}
                <td className="px-2 py-2.5 w-36 max-w-[9rem]">
                  <p className="text-xs font-semibold text-slate-900 truncate" title={pub.publisherName}>
                    {pub.publisherName}
                  </p>
                  {pub.amMember && (
                    <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">AM</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{pub.dataCenter}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{pub.csm}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{pub.csom}</td>
                <td className="px-2 py-2.5 text-xs text-slate-700 font-mono font-semibold tabular-nums whitespace-nowrap">
                  {formatNumber(pub.capacityAbsolute)}
                </td>
                {['east', 'west', 'emea', 'apac', 'jpac'].map(dc => (
                  <td key={dc} className="px-2 py-2.5 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                    {pub.dcAllocation[dc] ? formatNumber(pub.dcAllocation[dc]) : <span className="text-slate-200">—</span>}
                  </td>
                ))}
                {hasComparison && (
                  <>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {pub.changeAbs !== 0 ? (
                        <span className={`text-[11px] font-mono font-semibold tabular-nums ${pub.changeAbs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pub.changeAbs >= 0 ? '+' : ''}{formatNumber(pub.changeAbs)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {getChangeBadge(pub.change, pub.changeAbs, pub.isNew)}
                    </td>
                  </>
                )}
                <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{pub.integrationType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-slate-400 text-sm">No publishers found matching your search.</p>
        </div>
      )}
    </div>
  );
};
