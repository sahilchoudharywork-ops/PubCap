import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
} from 'recharts';
import { PublisherData } from '../types';
import { formatNumber } from '../lib/dataProcessor';

interface ChartsProps {
  data: PublisherData[];
  previousData: PublisherData[];
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#94a3b8'];
const DC_COLORS: Record<string, string> = {
  east: '#6366f1',
  west: '#8b5cf6',
  emea: '#ec4899',
  apac: '#f97316',
  jpac: '#14b8a6',
};

const tooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
};

export const Charts: React.FC<ChartsProps> = ({ data, previousData }) => {
  // --- Chart 1: Top 10 Publishers by Capacity ---
  const topPublishers = [...data]
    .sort((a, b) => b.capacityAbsolute - a.capacityAbsolute)
    .slice(0, 10)
    .map(d => ({
      name: d.publisherName.length > 14 ? d.publisherName.substring(0, 12) + '…' : d.publisherName,
      capacity: d.capacityAbsolute,
      traffic: d.totalTraffic,
    }));

  // --- Chart 2: Capacity Distribution (Donut) ---
  const sortedByCapacity = [...data].sort((a, b) => b.capacityAbsolute - a.capacityAbsolute);
  const top5 = sortedByCapacity.slice(0, 5);
  const others = sortedByCapacity.slice(5);
  const capacityDistribution = top5.map((d, i) => ({
    name: d.publisherName.length > 18 ? d.publisherName.substring(0, 16) + '…' : d.publisherName,
    value: d.capacityAbsolute,
    color: CHART_COLORS[i],
  }));
  if (others.length > 0) {
    capacityDistribution.push({
      name: `Others (${others.length})`,
      value: others.reduce((acc, d) => acc + d.capacityAbsolute, 0),
      color: CHART_COLORS[5],
    });
  }

  // --- Chart 3: DC Capacity Breakdown ---
  const dcNames = ['east', 'west', 'emea', 'apac', 'jpac'];
  const dcData = dcNames.map(dc => {
    const current = data.reduce((acc, d) => acc + (d.dcAllocation[dc] || 0), 0);
    const previous = previousData.reduce((acc, d) => acc + (d.dcAllocation[dc] || 0), 0);
    return { name: dc.toUpperCase(), current, previous };
  }).filter(d => d.current > 0 || d.previous > 0);

  // --- Chart 4: QoQ Top Movers ---
  const hasComparison = previousData.length > 0;
  const qoqMovers = data
    .map(curr => {
      const prev = previousData.find(p => p.publisherId === curr.publisherId);
      if (!prev || prev.capacityAbsolute === 0) return null;
      const diff = curr.capacityAbsolute - prev.capacityAbsolute;
      const pct = (diff / prev.capacityAbsolute) * 100;
      return {
        name: curr.publisherName.length > 14 ? curr.publisherName.substring(0, 12) + '…' : curr.publisherName,
        change: parseFloat(pct.toFixed(1)),
        changeAbs: diff,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && d.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-900 mb-1">Top 10 Publishers by Capacity</h3>
        <p className="text-xs text-slate-400 mb-5">Capacity allocation vs DC traffic for highest-volume publishers</p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPublishers} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                angle={-40}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#e2e8f0"
              />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#e2e8f0" />
              <Tooltip
                formatter={(val: number, name: string) => [formatNumber(val), name === 'capacity' ? 'Capacity' : 'DC Allocation']}
                contentStyle={tooltipStyle}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="capacity" name="Capacity" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="traffic" name="DC Allocation" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-900 mb-1">Capacity Share by Publisher</h3>
        <p className="text-xs text-slate-400 mb-5">Top 5 publishers vs rest of the pool</p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={capacityDistribution}
                cx="50%"
                cy="45%"
                innerRadius={75}
                outerRadius={115}
                paddingAngle={4}
                dataKey="value"
              >
                {capacityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number) => formatNumber(val)} contentStyle={tooltipStyle} />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-900 mb-1">Capacity by Data Center</h3>
        <p className="text-xs text-slate-400 mb-5">
          {hasComparison ? 'Current vs previous quarter allocation per DC' : 'Current quarter allocation per data center'}
        </p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dcData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#e2e8f0" />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#e2e8f0" />
              <Tooltip
                formatter={(val: number, name: string) => [formatNumber(val), name === 'current' ? 'Current Quarter' : 'Previous Quarter']}
                contentStyle={tooltipStyle}
              />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
              {hasComparison && (
                <Bar dataKey="previous" name="Previous Quarter" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              )}
              <Bar dataKey="current" name="Current Quarter" radius={[4, 4, 0, 0]}>
                {dcData.map((entry, index) => (
                  <Cell key={`dc-${index}`} fill={DC_COLORS[entry.name.toLowerCase()] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 4 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-900 mb-1">QoQ Top Movers</h3>
        <p className="text-xs text-slate-400 mb-5">
          {hasComparison
            ? 'Publishers with largest capacity change % quarter-over-quarter'
            : 'Upload previous quarter data to see QoQ movements'}
        </p>
        <div className="h-[320px] w-full">
          {hasComparison && qoqMovers.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qoqMovers} layout="vertical" margin={{ top: 10, right: 40, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#e2e8f0"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#e2e8f0"
                />
                <Tooltip
                  formatter={(val: number) => [`${val > 0 ? '+' : ''}${val}%`, 'Capacity Change']}
                  contentStyle={tooltipStyle}
                />
                <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1} />
                <Bar dataKey="change" name="Change %" radius={[0, 4, 4, 0]}>
                  {qoqMovers.map((entry, index) => (
                    <Cell key={`mover-${index}`} fill={entry.change >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-slate-300 text-sm">No comparison data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
