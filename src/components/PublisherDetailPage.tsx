import React from 'react';
import { ArrowLeft, Building2, User, MapPin, Hash } from 'lucide-react';
import { PublisherData } from '../types';
import { formatNumber } from '../lib/dataProcessor';

interface PublisherDetailPageProps {
  publisherId: string;
  currentData: PublisherData[];
  previousData: PublisherData[];
  onClose: () => void;
}

const DC_NAMES = ['east', 'west', 'emea', 'apac', 'jpac'];
const DC_LABELS: Record<string, string> = { east: 'East', west: 'West', emea: 'EMEA', apac: 'APAC', jpac: 'JPAC' };

export const PublisherDetailPage: React.FC<PublisherDetailPageProps> = ({
  publisherId, currentData, previousData, onClose,
}) => {
  const current  = currentData.find(d => d.publisherId === publisherId);
  const previous = previousData.find(d => d.publisherId === publisherId);

  if (!current) return null;

  const hasPrev = previousData.length > 0;

  const dcRows = DC_NAMES.map(dc => {
    const curr       = current.dcAllocation[dc]  ?? 0;
    const prev       = previous?.dcAllocation[dc] ?? 0;
    const changeAbs  = curr - prev;
    const changePct  = prev > 0 ? (changeAbs / prev) * 100 : null;
    return { dc, curr, prev, changeAbs, changePct };
  }).filter(r => r.curr > 0 || r.prev > 0);

  const totalCurr      = dcRows.reduce((s, r) => s + r.curr, 0);
  const totalPrev      = dcRows.reduce((s, r) => s + r.prev, 0);
  const totalChangeAbs = totalCurr - totalPrev;
  const totalChangePct = totalPrev > 0 ? (totalChangeAbs / totalPrev) * 100 : null;

  const ChangeBadge = ({ pct }: { pct: number | null }) => {
    if (pct === null) return <span className="text-slate-300 text-sm">—</span>;
    const cls = pct >= 0
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-rose-50 text-rose-700 border border-rose-200';
    return (
      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${cls}`}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    );
  };

  const ChangeAbs = ({ val, show }: { val: number; show: boolean }) => {
    if (!show) return <span className="text-slate-300 text-sm">—</span>;
    return (
      <span className={`text-sm font-mono font-semibold tabular-nums ${val >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {val >= 0 ? '+' : ''}{formatNumber(val)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
      {/* Sticky top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-sm font-bold text-slate-900 truncate">{current.publisherName}</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {current.publisherId}
          </span>
          {current.amMember && (
            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">AM</span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Publisher info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Publisher Name', value: current.publisherName, Icon: Building2 },
            { label: 'Publisher ID',   value: current.publisherId,   Icon: Hash },
            { label: 'POD',            value: current.pod  || '—',   Icon: MapPin },
            { label: 'CSOM',           value: current.csom || '—',   Icon: User },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 truncate" title={value}>{value}</p>
            </div>
          ))}
        </div>

        {/* DC Allocation table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">DC-Level Capacity Allocation</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasPrev
                ? 'Current vs previous quarter breakdown by data center'
                : 'Current quarter breakdown by data center'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Center</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Current Quarter</th>
                  {hasPrev && (
                    <>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Previous Quarter</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Δ Absolute</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Δ %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dcRows.map(({ dc, curr, prev, changeAbs, changePct }) => (
                  <tr key={dc} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-bold text-slate-700">{DC_LABELS[dc]}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-mono font-semibold text-slate-700 tabular-nums">
                      {formatNumber(curr)}
                    </td>
                    {hasPrev && (
                      <>
                        <td className="px-4 py-3.5 text-right text-sm font-mono text-slate-500 tabular-nums">
                          {prev > 0 ? formatNumber(prev) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChangeAbs val={changeAbs} show={prev > 0 || curr > 0} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChangeBadge pct={changePct} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3.5 text-right text-sm font-mono font-bold text-slate-900 tabular-nums">
                    {formatNumber(totalCurr)}
                  </td>
                  {hasPrev && (
                    <>
                      <td className="px-4 py-3.5 text-right text-sm font-mono font-semibold text-slate-600 tabular-nums">
                        {totalPrev > 0 ? formatNumber(totalPrev) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChangeAbs val={totalChangeAbs} show={totalPrev > 0 || totalCurr > 0} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChangeBadge pct={totalChangePct} />
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
