import React from 'react';
import { Filter, X, ChevronDown, Check, Square } from 'lucide-react';
import { PublisherData } from '../types';

interface FiltersProps {
  data: PublisherData[];
  onFilterChange: (filtered: PublisherData[]) => void;
}

// ─── Shared MultiSelect ────────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter(s => s !== option)
        : [...selected, option]
    );
  };

  const selectAll   = (e: React.MouseEvent) => { e.stopPropagation(); onChange([...options]); };
  const clearAll    = (e: React.MouseEvent) => { e.stopPropagation(); onChange([]); };
  const allSelected = options.length > 0 && selected.length === options.length;

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">{label}</label>

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`relative flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all min-w-[148px] ${
          selected.length > 0
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}
      >
        <span className="truncate max-w-[108px]">
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 rounded-full leading-tight py-0.5">
              {selected.length}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 min-w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Select All / Clear All header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {options.length} option{options.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {!allSelected && (
                <button
                  onMouseDown={selectAll}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Select all
                </button>
              )}
              {selected.length > 0 && (
                <button
                  onMouseDown={clearAll}
                  className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {options.map(option => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  onMouseDown={e => { e.preventDefault(); toggle(option); }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors ${
                    isSelected ? 'bg-indigo-50/60 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {/* Checkbox */}
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Active filter chips ───────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  onRemove: () => void;
}
const Chip: React.FC<ChipProps> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-200">
    {label}
    <button onClick={onRemove} className="hover:text-indigo-900 transition-colors ml-0.5">
      <X className="w-2.5 h-2.5" />
    </button>
  </span>
);

// ─── Filters panel ─────────────────────────────────────────────────────────────

export const Filters: React.FC<FiltersProps> = ({ data, onFilterChange }) => {
  const [selectedDCs,           setSelectedDCs]           = React.useState<string[]>([]);
  const [selectedCSMs,          setSelectedCSMs]          = React.useState<string[]>([]);
  const [selectedCSOMs,         setSelectedCSOMs]         = React.useState<string[]>([]);
  const [selectedIntegrations,  setSelectedIntegrations]  = React.useState<string[]>([]);
  const [selectedRegions,       setSelectedRegions]       = React.useState<string[]>([]);
  const [pubIdQuery,            setPubIdQuery]            = React.useState('');

  const dcList      = ['EAST', 'WEST', 'EMEA', 'APAC', 'JPAC'];
  const csms        = React.useMemo(() => [...new Set(data.map(d => d.csm).filter(Boolean))].sort(),              [data]);
  const csoms       = React.useMemo(() => [...new Set(data.map(d => d.csom).filter(Boolean))].sort(),             [data]);
  const integrations= React.useMemo(() => [...new Set(data.map(d => d.integrationType).filter(Boolean))].sort(),  [data]);
  const regions     = React.useMemo(() => [...new Set(data.map(d => d.dataCenter).filter(Boolean))].sort(),       [data]);

  // ── Filter logic ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let filtered = data;
    if (selectedDCs.length > 0)
      filtered = filtered.filter(d => selectedDCs.some(dc => (d.dcAllocation[dc.toLowerCase()] || 0) > 0));
    if (selectedRegions.length > 0)
      filtered = filtered.filter(d => selectedRegions.includes(d.dataCenter));
    if (selectedCSMs.length > 0)
      filtered = filtered.filter(d => selectedCSMs.includes(d.csm));
    if (selectedCSOMs.length > 0)
      filtered = filtered.filter(d => selectedCSOMs.includes(d.csom));
    if (selectedIntegrations.length > 0)
      filtered = filtered.filter(d => selectedIntegrations.includes(d.integrationType));
    if (pubIdQuery.trim())
      filtered = filtered.filter(d =>
        d.publisherId.toLowerCase().includes(pubIdQuery.toLowerCase()) ||
        d.publisherName.toLowerCase().includes(pubIdQuery.toLowerCase())
      );
    onFilterChange(filtered);
  }, [selectedDCs, selectedRegions, selectedCSMs, selectedCSOMs, selectedIntegrations, pubIdQuery, data, onFilterChange]);

  const resetAll = () => {
    setSelectedDCs([]);
    setSelectedRegions([]);
    setSelectedCSMs([]);
    setSelectedCSOMs([]);
    setSelectedIntegrations([]);
    setPubIdQuery('');
  };

  // ── Active chips ─────────────────────────────────────────────────────────────
  const chips: { label: string; onRemove: () => void }[] = [
    ...selectedDCs.map(v => ({ label: `DC: ${v}`, onRemove: () => setSelectedDCs(prev => prev.filter(x => x !== v)) })),
    ...selectedRegions.map(v => ({ label: `Region: ${v}`, onRemove: () => setSelectedRegions(prev => prev.filter(x => x !== v)) })),
    ...selectedCSMs.map(v => ({ label: `CSM: ${v}`, onRemove: () => setSelectedCSMs(prev => prev.filter(x => x !== v)) })),
    ...selectedCSOMs.map(v => ({ label: `CSOM: ${v}`, onRemove: () => setSelectedCSOMs(prev => prev.filter(x => x !== v)) })),
    ...selectedIntegrations.map(v => ({ label: v, onRemove: () => setSelectedIntegrations(prev => prev.filter(x => x !== v)) })),
  ];

  const hasActiveFilters = chips.length > 0 || pubIdQuery !== '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1">
      {/* Top row: dropdowns */}
      <div className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-slate-500 self-end pb-1.5">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-semibold">Filters</span>
        </div>

        {/* Publisher ID search */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">Publisher ID</label>
          <input
            type="text"
            placeholder="Search ID or name…"
            value={pubIdQuery}
            onChange={e => setPubIdQuery(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-all w-[160px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              pubIdQuery ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          />
        </div>

        <MultiSelect label="Region"      options={regions}      selected={selectedRegions}      onChange={setSelectedRegions}      placeholder="All Regions" />
        <MultiSelect label="Data Center" options={dcList}       selected={selectedDCs}           onChange={setSelectedDCs}           placeholder="All DCs" />
        <MultiSelect label="CSM"         options={csms}         selected={selectedCSMs}          onChange={setSelectedCSMs}          placeholder="All CSMs" />
        <MultiSelect label="CSOM"        options={csoms}        selected={selectedCSOMs}         onChange={setSelectedCSOMs}         placeholder="All CSOMs" />
        <MultiSelect label="Integration" options={integrations} selected={selectedIntegrations}  onChange={setSelectedIntegrations}  placeholder="All Types" />

        {hasActiveFilters && (
          <button
            onClick={resetAll}
            className="self-end mb-0.5 flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-50"
          >
            <X className="w-3 h-3" /> Reset all
          </button>
        )}
      </div>

      {/* Active chips row */}
      {chips.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">Active:</span>
          {chips.map((chip, i) => (
            <Chip key={i} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}
    </div>
  );
};
