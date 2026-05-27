import React from 'react';
import { TrendingUp, TrendingDown, UserPlus, UserMinus, Server, AlertTriangle } from 'lucide-react';
import { PublisherData, QoQMetrics } from '../types';
import { formatNumber } from '../lib/dataProcessor';

interface InsightsProps {
  data: PublisherData[];
  previousData: PublisherData[];
  metrics: QoQMetrics | null;
}

interface InsightItem {
  label: string;
  sub?: string;
  tag?: 'increase' | 'decrease' | 'new' | 'dropped' | 'neutral';
}

interface InsightCard {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  items: InsightItem[];
  emptyMsg: string;
}

export const Insights: React.FC<InsightsProps> = ({ data, previousData, metrics }) => {
  const hasComparison = previousData.length > 0;

  // Compute per-publisher QoQ changes
  const qoqChanges = hasComparison
    ? data
        .map(curr => {
          const prev = previousData.find(p => p.publisherId === curr.publisherId);
          if (!prev || prev.capacityAbsolute === 0) return null;
          const diff = curr.capacityAbsolute - prev.capacityAbsolute;
          const pct = (diff / prev.capacityAbsolute) * 100;
          return { name: curr.publisherName, id: curr.publisherId, diff, pct, curr, prev };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
    : [];

  const topIncreases = [...qoqChanges]
    .filter(d => d.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const topDecreases = [...qoqChanges]
    .filter(d => d.pct < 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  // New publishers (in current, not in previous)
  const newPubs = (metrics?.newPublishers || [])
    .map(id => {
      const pub = data.find(p => p.publisherId === id);
      return pub ? { name: pub.publisherName, id, capacity: pub.capacityAbsolute } : { name: id, id, capacity: 0 };
    })
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 5);

  // Dropped publishers (in previous, not in current)
  const droppedPubs = (metrics?.droppedPublishers || [])
    .map(id => {
      const pub = previousData.find(p => p.publisherId === id);
      return pub ? { name: pub.publisherName, id, capacity: pub.capacityAbsolute } : { name: id, id, capacity: 0 };
    })
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 5);

  // DC capacity totals (current vs previous)
  const dcNames = ['east', 'west', 'emea', 'apac', 'jpac'];
  const dcComparison = dcNames
    .map(dc => {
      const curr = data.reduce((acc, d) => acc + (d.dcAllocation[dc] || 0), 0);
      const prev = previousData.reduce((acc, d) => acc + (d.dcAllocation[dc] || 0), 0);
      const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      return { dc: dc.toUpperCase(), curr, prev, pct };
    })
    .filter(d => d.curr > 0)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const cards: InsightCard[] = [
    {
      title: 'Top Capacity Increases',
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      emptyMsg: hasComparison ? 'No publishers with increased capacity' : 'Upload previous quarter to see increases',
      items: topIncreases.map(d => ({
        label: d.name,
        sub: `+${formatNumber(d.diff)} (+${d.pct.toFixed(1)}%)`,
        tag: 'increase' as const,
      })),
    },
    {
      title: 'Top Capacity Decreases',
      icon: TrendingDown,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      emptyMsg: hasComparison ? 'No publishers with decreased capacity' : 'Upload previous quarter to see decreases',
      items: topDecreases.map(d => ({
        label: d.name,
        sub: `${formatNumber(d.diff)} (${d.pct.toFixed(1)}%)`,
        tag: 'decrease' as const,
      })),
    },
    {
      title: `New Publishers (${newPubs.length})`,
      icon: UserPlus,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      emptyMsg: hasComparison ? 'No new publishers this quarter' : 'Upload previous quarter to compare',
      items: newPubs.map(p => ({
        label: p.name,
        sub: p.capacity > 0 ? formatNumber(p.capacity) : '—',
        tag: 'new' as const,
      })),
    },
    {
      title: `Dropped Publishers (${droppedPubs.length})`,
      icon: UserMinus,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      emptyMsg: hasComparison ? 'No dropped publishers this quarter' : 'Upload previous quarter to compare',
      items: droppedPubs.map(p => ({
        label: p.name,
        sub: p.capacity > 0 ? `Was: ${formatNumber(p.capacity)}` : '—',
        tag: 'dropped' as const,
      })),
    },
    {
      title: 'DC Capacity Overview',
      icon: Server,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      emptyMsg: 'No data center allocation data found',
      items: dcComparison.map(d => ({
        label: `${d.dc}: ${formatNumber(d.curr)}`,
        sub: hasComparison && d.prev > 0
          ? `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}% vs prev quarter`
          : 'Current quarter',
        tag: d.pct > 0 ? ('increase' as const) : d.pct < 0 ? ('decrease' as const) : ('neutral' as const),
      })),
    },
    {
      title: 'Largest QoQ Absolute Changes',
      icon: AlertTriangle,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
      emptyMsg: hasComparison ? 'No significant changes detected' : 'Upload previous quarter to compare',
      items: [...qoqChanges]
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 5)
        .map(d => ({
          label: d.name,
          sub: `${d.diff >= 0 ? '+' : ''}${formatNumber(d.diff)} (${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%)`,
          tag: d.diff >= 0 ? ('increase' as const) : ('decrease' as const),
        })),
    },
  ];

  const tagStyles: Record<string, string> = {
    increase: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    decrease: 'bg-rose-50 text-rose-700 border border-rose-100',
    new: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    dropped: 'bg-orange-50 text-orange-700 border border-orange-100',
    neutral: 'bg-slate-50 text-slate-500 border border-slate-100',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${card.iconBg}`}>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">{card.title}</h4>
          </div>
          <ul className="space-y-2.5">
            {card.items.length > 0 ? (
              card.items.map((item, j) => (
                <li key={j} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-700 font-medium leading-tight truncate max-w-[55%]" title={item.label}>
                    {item.label}
                  </span>
                  {item.sub && item.tag && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${tagStyles[item.tag]}`}>
                      {item.sub}
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-400 italic">{card.emptyMsg}</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
};
