import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, FileSpreadsheet, Info, BarChart2, TrendingUp, FileCheck } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { SummaryCards } from './components/SummaryCards';
import { Charts } from './components/Charts';
import { PublisherTable } from './components/PublisherTable';
import { Filters } from './components/Filters';
import { Insights } from './components/Insights';
import { SupplyTrendPanel } from './components/SupplyTrendPanel';
import { PublisherDetailPage } from './components/PublisherDetailPage';
import { calculateQoQ, downloadTemplate, parseSupplyTrend, buildSupplyAnalysis } from './lib/dataProcessor';
import { PublisherData, DashboardState, SupplyTrendEntry, PublisherSupplyAnalysis } from './types';
import { Download, Play, RefreshCcw, Upload } from 'lucide-react';

type Tab = 'qoq' | 'supply';

// ─── sessionStorage helpers ───────────────────────────────────────────────────

const SESSION_KEY = 'pubcap_session_v1';

interface PersistedSession {
  currentData:    PublisherData[];
  previousData:   PublisherData[];
  metrics:        DashboardState['metrics'];
  supplyTrendData:SupplyTrendEntry[];
  isAnalysisStarted: boolean;
  activeTab:      Tab;
  supplyFileName: string | null;
}

const saveSession = (s: PersistedSession) => {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* quota */ }
};

const loadSession = (): PersistedSession | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    // Sanity check: must have real data to be worth restoring
    if (!parsed.currentData?.length) return null;
    return parsed;
  } catch { return null; }
};

const clearSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<DashboardState>(() => {
    // Attempt to restore from sessionStorage on first render
    const saved = loadSession();
    if (saved) {
      return {
        currentData:    saved.currentData,
        previousData:   saved.previousData,
        filteredData:   saved.currentData, // reset filters on restore
        metrics:        saved.metrics,
        supplyTrendData:saved.supplyTrendData,
        loading:        false,
        error:          null,
      };
    }
    return {
      currentData:    [],
      previousData:   [],
      filteredData:   [],
      metrics:        null,
      supplyTrendData:[],
      loading:        false,
      error:          null,
    };
  });

  const [isAnalysisStarted, setIsAnalysisStarted] = useState<boolean>(() => loadSession()?.isAnalysisStarted ?? false);
  const [activeTab, setActiveTab]                 = useState<Tab>(() => loadSession()?.activeTab ?? 'qoq');
  const [supplyLoading, setSupplyLoading]         = useState(false);
  const [supplyError, setSupplyError]             = useState<string | null>(null);
  const [supplyFileName, setSupplyFileName]       = useState<string | null>(() => loadSession()?.supplyFileName ?? null);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);

  // ── Persist to sessionStorage whenever meaningful state changes ───────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isAnalysisStarted) return; // only persist once analysis has begun
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSession({
        currentData:       state.currentData,
        previousData:      state.previousData,
        metrics:           state.metrics,
        supplyTrendData:   state.supplyTrendData,
        isAnalysisStarted,
        activeTab,
        supplyFileName,
      });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state.currentData, state.previousData, state.metrics, state.supplyTrendData, isAnalysisStarted, activeTab, supplyFileName]);

  // ── Capacity file loaded ──────────────────────────────────────────────────
  const handleDataLoaded = React.useCallback((data: PublisherData[], type: 'current' | 'previous') => {
    setState(prev => {
      const next = { ...prev };
      if (type === 'current') {
        next.currentData  = data;
        next.filteredData = data;
      } else {
        next.previousData = data;
      }
      if (next.currentData.length > 0 && next.previousData.length > 0) {
        next.metrics = calculateQoQ(next.currentData, next.previousData);
      } else {
        next.metrics = null;
      }
      return next;
    });
  }, []);

  // ── Supply trend file loaded ──────────────────────────────────────────────
  const handleSupplyTrendFile = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSupplyLoading(true);
    setSupplyError(null);
    setSupplyFileName(file.name);
    try {
      const data = await parseSupplyTrend(file);
      setState(prev => ({ ...prev, supplyTrendData: data }));
    } catch (err) {
      setSupplyError(err instanceof Error ? err.message : 'Failed to parse supply trend file');
      setSupplyFileName(null);
      setState(prev => ({ ...prev, supplyTrendData: [] }));
    } finally {
      setSupplyLoading(false);
    }
  }, []);

  // ── Filter change ─────────────────────────────────────────────────────────
  const handleFilterChange = React.useCallback((filtered: PublisherData[]) => {
    setState(prev => ({ ...prev, filteredData: filtered }));
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const canStartAnalysis = state.currentData.length > 0 && state.previousData.length > 0;
  const hasSupplyData    = state.supplyTrendData.length > 0;

  const supplyAnalysis: PublisherSupplyAnalysis[] = React.useMemo(() => {
    if (!hasSupplyData || state.filteredData.length === 0) return [];
    return buildSupplyAnalysis(state.filteredData, state.supplyTrendData);
  }, [state.filteredData, state.supplyTrendData, hasSupplyData]);

  const handleStartAnalysis = () => { if (canStartAnalysis) setIsAnalysisStarted(true); };

  const handleReset = () => {
    clearSession();
    setState({ currentData: [], previousData: [], filteredData: [], metrics: null, supplyTrendData: [], loading: false, error: null });
    setIsAnalysisStarted(false);
    setActiveTab('qoq');
    setSupplyFileName(null);
    setSupplyError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

      {/* ── Publisher Detail Overlay ────────────────────────────────────────── */}
      {selectedPublisherId && (
        <PublisherDetailPage
          publisherId={selectedPublisherId}
          currentData={state.currentData}
          previousData={state.previousData}
          onClose={() => setSelectedPublisherId(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

        {/* ── Upload Screen ────────────────────────────────────────────────── */}
        {!isAnalysisStarted ? (
          <div className="max-w-4xl mx-auto mt-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900">Welcome to PubCap</h2>
              <p className="text-slate-500 mt-3">Upload the required capacity files and an optional supply trend file to unlock full analysis.</p>
            </div>

            {/* Capacity files row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload label="Current Quarter Data" type="current" onDataLoaded={handleDataLoaded} isLoaded={state.currentData.length > 0} />
              <FileUpload label="Previous Quarter Data" type="previous" onDataLoaded={handleDataLoaded} isLoaded={state.previousData.length > 0} />
            </div>

            {/* Supply trend upload */}
            <div className="mt-6">
              <div className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-5 transition-all duration-200 ${
                supplyFileName
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-violet-400 hover:bg-violet-50/30'
              }`}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleSupplyTrendFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl shrink-0 transition-colors ${
                    supplyFileName ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-violet-100'
                  }`}>
                    {supplyLoading
                      ? <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                      : supplyFileName
                      ? <FileCheck className="w-5 h-5 text-emerald-600" />
                      : <TrendingUp className="w-5 h-5 text-slate-400 group-hover:text-violet-600 transition-colors" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${supplyFileName ? 'text-emerald-700' : 'text-slate-700'}`}>
                        Supply Trend File
                      </p>
                      {!supplyFileName && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">OPTIONAL</span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${supplyFileName ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {supplyFileName
                        ? `${supplyFileName} — ${state.supplyTrendData.length} publishers loaded`
                        : 'CSV/Excel with daily publisher request volume + geCPM. Unlocks Supply Trend analysis tab.'}
                    </p>
                    {supplyError && <p className="text-xs text-rose-600 mt-1">⚠ {supplyError}</p>}
                  </div>
                  <div className={`shrink-0 flex items-center gap-2 text-xs font-semibold transition-colors ${
                    supplyFileName ? 'text-emerald-600' : 'text-slate-400 group-hover:text-violet-600'
                  }`}>
                    {supplyFileName ? <FileCheck className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {supplyFileName ? 'Loaded' : 'Browse'}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
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

            {/* Template hint */}
            <div className="mt-10 bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4" /> Expected Format
                  </h4>
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Capacity files: Publisher ID (Ω), Name, Region, Capacity (ALLOCATION), DC breakdown columns.<br />
                    Supply Trend: Publisher ID column + date columns for daily requests + optional geCPM columns.
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
                >
                  <Download className="w-4 h-4" /> Template
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* ── Analysis Screen ──────────────────────────────────────────────── */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Top bar: filters + controls */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <Filters data={state.currentData} onFilterChange={handleFilterChange} />
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-white border border-slate-200 rounded-xl shadow-sm"
                >
                  <RefreshCcw className="w-4 h-4" /> New Analysis
                </button>
                {/* File status dots */}
                <div className="flex -space-x-2">
                  <div title="Current quarter" className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${state.currentData.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>Q1</div>
                  <div title="Previous quarter" className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${state.previousData.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>Q2</div>
                  <div title="Supply trend" className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${hasSupplyData ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-400'}`}>ST</div>
                </div>
              </div>
            </div>

            {/* ── Tab switcher ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
              <button
                onClick={() => setActiveTab('qoq')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'qoq'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                QoQ Analysis
              </button>
              <button
                onClick={() => setActiveTab('supply')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'supply'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-violet-600 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Supply Trend
                {hasSupplyData
                  ? <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{state.supplyTrendData.length}</span>
                  : <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">optional</span>
                }
              </button>
            </div>

            {/* ── QoQ Tab ──────────────────────────────────────────────────── */}
            {activeTab === 'qoq' && (
              <div className="space-y-8">
                <SummaryCards data={state.filteredData} metrics={state.metrics} />
                <Insights data={state.filteredData} previousData={state.previousData} metrics={state.metrics} />
                <Charts data={state.filteredData} previousData={state.previousData} />
                <PublisherTable data={state.filteredData} previousData={state.previousData} onPublisherClick={setSelectedPublisherId} />
              </div>
            )}

            {/* ── Supply Trend Tab ─────────────────────────────────────────── */}
            {activeTab === 'supply' && (
              <div>
                {hasSupplyData ? (
                  <SupplyTrendPanel analysis={supplyAnalysis} onPublisherClick={setSelectedPublisherId} />
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center">
                    <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-7 h-7 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No Supply Trend Data</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                      Upload a Supply Trend file (CSV/Excel with daily publisher request volume and geCPM)
                      to see how approved capacity compares against actual supply.
                    </p>
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-violet-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors relative">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleSupplyTrendFile}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <Upload className="w-4 h-4" />
                      Upload Supply Trend File
                    </label>
                    {supplyLoading && <p className="text-sm text-violet-600 mt-3 animate-pulse">Parsing file…</p>}
                    {supplyError && <p className="text-sm text-rose-600 mt-3">⚠ {supplyError}</p>}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
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
