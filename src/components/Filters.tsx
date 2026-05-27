import React from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { PublisherData } from '../types';

interface FiltersProps {
  data: PublisherData[];
  onFilterChange: (filtered: PublisherData[]) => void;
}

const MultiSelect: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ label, options, selected, onChange, placeholder = 'Select...' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 min-w-[140px] flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
      >
        <span className="truncate max-w-[120px]">
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-[300px] overflow-y-auto">
          {options.map(option => (
            <button
              key={option}
              onClick={() => toggleOption(option)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between group"
            >
              <span className={selected.includes(option) ? 'font-semibold text-indigo-600' : 'text-slate-600'}>
                {option}
              </span>
              {selected.includes(option) && <Check className="w-4 h-4 text-indigo-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Filters: React.FC<FiltersProps> = ({ data, onFilterChange }) => {
  const [selectedDCs, setSelectedDCs] = React.useState<string[]>([]);
  const [selectedCSMs, setSelectedCSMs] = React.useState<string[]>([]);
  const [selectedCSOMs, setSelectedCSOMs] = React.useState<string[]>([]);
  const [selectedIntegrations, setSelectedIntegrations] = React.useState<string[]>([]);
  const [pubIdQuery, setPubIdQuery] = React.useState<string>('');
  const [selectedPubNames, setSelectedPubNames] = React.useState<string[]>([]);

  const dcList = ['EAST', 'WEST', 'EMEA', 'APAC', 'JPAC'];
  const csms = React.useMemo(() => [...new Set(data.map(d => d.csm))].sort(), [data]);
  const csoms = React.useMemo(() => [...new Set(data.map(d => d.csom))].sort(), [data]);
  const integrations = React.useMemo(() => [...new Set(data.map(d => d.integrationType))].sort(), [data]);
  const pubNames = React.useMemo(() => [...new Set(data.map(d => d.publisherName))].sort(), [data]);

  React.useEffect(() => {
    let filtered = data;
    
    if (selectedDCs.length > 0) {
      filtered = filtered.filter(d => 
        selectedDCs.some(dc => (d.dcAllocation[dc.toLowerCase()] || 0) > 0)
      );
    }
    
    if (selectedCSMs.length > 0) {
      filtered = filtered.filter(d => selectedCSMs.includes(d.csm));
    }
    
    if (selectedCSOMs.length > 0) {
      filtered = filtered.filter(d => selectedCSOMs.includes(d.csom));
    }
    
    if (selectedIntegrations.length > 0) {
      filtered = filtered.filter(d => selectedIntegrations.includes(d.integrationType));
    }
    
    if (pubIdQuery.trim() !== '') {
      filtered = filtered.filter(d => d.publisherId.toLowerCase().includes(pubIdQuery.toLowerCase()));
    }
    
    if (selectedPubNames.length > 0) {
      filtered = filtered.filter(d => selectedPubNames.includes(d.publisherName));
    }
    
    onFilterChange(filtered);
  }, [selectedDCs, selectedCSMs, selectedCSOMs, selectedIntegrations, pubIdQuery, selectedPubNames, data, onFilterChange]);

  const resetFilters = () => {
    setSelectedDCs([]);
    setSelectedCSMs([]);
    setSelectedCSOMs([]);
    setSelectedIntegrations([]);
    setPubIdQuery('');
    setSelectedPubNames([]);
  };

  const hasActiveFilters = selectedDCs.length > 0 || selectedCSMs.length > 0 || selectedCSOMs.length > 0 || selectedIntegrations.length > 0 || pubIdQuery !== '' || selectedPubNames.length > 0;

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-slate-500 mr-2">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-semibold">Filters</span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Publisher ID Search</label>
        <input 
          type="text"
          placeholder="Type ID..."
          value={pubIdQuery}
          onChange={(e) => setPubIdQuery(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 w-[120px]"
        />
      </div>

      <MultiSelect 
        label="Publisher Name"
        options={pubNames}
        selected={selectedPubNames}
        onChange={setSelectedPubNames}
        placeholder="All Publishers"
      />

      <MultiSelect 
        label="Data Center"
        options={dcList}
        selected={selectedDCs}
        onChange={setSelectedDCs}
        placeholder="All DCs"
      />

      <MultiSelect 
        label="CSM"
        options={csms}
        selected={selectedCSMs}
        onChange={setSelectedCSMs}
        placeholder="All CSMs"
      />

      <MultiSelect 
        label="CSOM"
        options={csoms}
        selected={selectedCSOMs}
        onChange={setSelectedCSOMs}
        placeholder="All CSOMs"
      />

      <MultiSelect 
        label="Integration"
        options={integrations}
        selected={selectedIntegrations}
        onChange={setSelectedIntegrations}
        placeholder="All Types"
      />

      {hasActiveFilters && (
        <button 
          onClick={resetFilters}
          className="mt-5 flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
};
