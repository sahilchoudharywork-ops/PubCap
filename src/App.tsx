import React, { useState } from 'react';
import { LayoutDashboard, FileSpreadsheet, Info } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { SummaryCards } from './components/SummaryCards';
import { Charts } from './components/Charts';
import { PublisherTable } from './components/PublisherTable';
import { Filters } from './components/Filters';
import { Insights } from './components/Insights';
import { calculateQoQ, downloadTemplate } from './lib/dataProcessor';
import { PublisherData, DashboardState } from './types';
import { Download, Play, RefreshCcw } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<DashboardState>({
    currentData: [],
    previousData: [],
    filteredData: [],
    metrics: null,
    loading: false,
    error: null
  });
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false);

  const handleDataLoaded = React.useCallback((data: PublisherData[], type: 'current' | 'previous') => {
    setState(prev => {
      const newState = { ...prev };
      if (type === 'current') {
        newState.currentData = data;
        newState.filteredData = data;
      } else {
        newState.previousData = data;
      }

      if (newState.currentData.length > 0 && newState.previousData.length > 0) {
        newState.metrics = calculateQoQ(newState.currentData, newState.previousData);
      } else {
        newState.metrics = null;
      }

      return newState;
    });
  }, []);

  const handleFilterChange = React.useCallback((filtered: PublisherData[]) => {
    setState(prev => ({ ...prev, filteredData: filtered }));
  }, []);

  const isDataReady = state.currentData.length > 0;
  const canStartAnalysis = state.currentData.length > 0 && state.previousData.length > 0;

  const handleStartAnalysis = () => {
    if (canStartAnalysis) {
      setIsAnalysisStarted(true);
    }
  };

  const handleReset = () => {
    setState({ 
      currentData: [], 
      previousData: [], 
      filteredData: [], 
      metrics: null,
      loading: false,
      error: null
    });
    setIsAnalysisStarted(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PubCap Analytics</h1>
              <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">System.Capacity_v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Info className="w-5 h-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
              SC
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAnalysisStarted ? (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">Welcome to PubCap</h2>
              <p className="text-slate-500 mt-3">Upload both current and previous quarterly publisher data to start the analysis.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload 
                label="Current Quarter Data" 
                type="current" 
                onDataLoaded={handleDataLoaded}
                isLoaded={state.currentData.length > 0}
              />
              <FileUpload 
                label="Previous Quarter Data" 
                type="previous" 
                onDataLoaded={handleDataLoaded}
                isLoaded={state.previousData.length > 0}
              />
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={handleStartAnalysis}
                disabled={!canStartAnalysis}
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                  canStartAnalysis 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                Start Analysis
              </button>
            </div>

            <div className="mt-12 bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4" /> Expected Format
                  </h4>
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Your Excel file should contain columns for Publisher ID (Ω), Name, Data Center (Region), Capacity (ALLOCATION), and breakdown columns. 
                    Use our official template to ensure perfect data mapping.
                  </p>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Top Section: Filters & Upload Mini */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <Filters data={state.currentData} onFilterChange={handleFilterChange} />
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-white border border-slate-200 rounded-xl shadow-sm"
                >
                  <RefreshCcw className="w-4 h-4" />
                  New Analysis
                </button>
                <div className="flex -space-x-2">
                  <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${state.currentData.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>Q1</div>
                  <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${state.previousData.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>Q2</div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <SummaryCards data={state.filteredData} metrics={state.metrics} />

            {/* Insights */}
            <Insights 
              data={state.filteredData} 
              previousData={state.previousData} 
              metrics={state.metrics} 
            />

            {/* Charts */}
            <Charts data={state.filteredData} previousData={state.previousData} />

            {/* Table */}
            <PublisherTable 
              data={state.filteredData} 
              previousData={state.previousData} 
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">© 2026 PubCap Analytics. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Support</a>
            <a href="#" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
