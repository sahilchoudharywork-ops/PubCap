import React from 'react';
import { Users, Zap, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { PublisherData, QoQMetrics } from '../types';
import { formatNumber } from '../lib/dataProcessor';

interface SummaryCardsProps {
  data: PublisherData[];
  metrics: QoQMetrics | null;
}

const QoQBadge: React.FC<{ val: number }> = ({ val }) => {
  const isPos = val > 0.05;
  const isNeg = val < -0.05;
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const cls = isPos
    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
    : isNeg
    ? 'text-rose-700 bg-rose-50 border border-rose-200'
    : 'text-slate-500 bg-slate-50 border border-slate-200';
  return (
    <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded-md ${cls}`}>
      <Icon className="w-3 h-3" />
      {isPos ? '+' : ''}{val.toFixed(1)}% QoQ
    </div>
  );
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({ data, metrics }) => {
  const totalPublishers = data.length;
  const totalCapacity = data.reduce((acc, d) => acc + d.capacityAbsolute, 0);
  const amPublishers = data.filter(d => d.amMember).length;

  const prevCapacity = metrics ? totalCapacity - metrics.capacityChangeAbs : null;

  const cards = [
    {
      label: 'Total Publishers',
      value: totalPublishers.toLocaleString(),
      icon: Users,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      sub: metrics
        ? `${metrics.newPublishers.length} new · ${metrics.droppedPublishers.length} dropped this quarter`
        : 'Upload previous quarter to compare',
      badge: null as React.ReactNode,
    },
    {
      label: 'Total Capacity (Ad Requests)',
      value: formatNumber(totalCapacity),
      icon: Zap,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      sub: prevCapacity !== null
        ? `Previous quarter: ${formatNumber(prevCapacity)}`
        : 'Current quarter capacity',
      badge: metrics ? <QoQBadge val={metrics.capacityChangePct} /> : null as React.ReactNode,
    },
    {
      label: 'AM Member Publishers',
      value: amPublishers.toLocaleString(),
      icon: Star,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
      sub: totalPublishers > 0
        ? `${((amPublishers / totalPublishers) * 100).toFixed(0)}% of total publishers are AM members`
        : '—',
      badge: null as React.ReactNode,
    },
    {
      label: 'QoQ Capacity Change',
      value: metrics ? formatNumber(Math.abs(metrics.capacityChangeAbs)) : '—',
      icon: metrics && metrics.capacityChangeAbs >= 0 ? TrendingUp : TrendingDown,
      iconColor: metrics
        ? metrics.capacityChangeAbs >= 0
          ? 'text-emerald-600'
          : 'text-rose-600'
        : 'text-slate-400',
      iconBg: metrics
        ? metrics.capacityChangeAbs >= 0
          ? 'bg-emerald-50'
          : 'bg-rose-50'
        : 'bg-slate-50',
      sub: metrics
        ? metrics.capacityChangeAbs >= 0
          ? `Capacity grew by ${formatNumber(metrics.capacityChangeAbs)} this quarter`
          : `Capacity reduced by ${formatNumber(Math.abs(metrics.capacityChangeAbs))} this quarter`
        : 'Upload previous quarter to compare',
      badge: metrics ? <QoQBadge val={metrics.capacityChangePct} /> : null as React.ReactNode,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${card.iconBg}`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            {card.badge}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
            <h3 className="text-3xl font-mono font-medium text-slate-900 tabular-nums">{card.value}</h3>
            <p className="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
