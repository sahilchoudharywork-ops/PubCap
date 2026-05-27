import React, { useCallback } from 'react';
import { Upload, FileCheck, AlertCircle } from 'lucide-react';
import { parseExcel } from '../lib/dataProcessor';
import { PublisherData } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: PublisherData[], type: 'current' | 'previous') => void;
  label: string;
  type: 'current' | 'previous';
  isLoaded: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, label, type, isLoaded }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await parseExcel(file);
      onDataLoaded(data, type);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded, type]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
        isLoaded ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
      }`}>
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          ) : isLoaded ? (
            <FileCheck className="w-8 h-8 text-emerald-600" />
          ) : (
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
          )}
          <div>
            <p className={`text-sm font-semibold ${isLoaded ? 'text-emerald-700' : 'text-slate-600'}`}>
              {isLoaded ? (fileName || 'File Accepted') : 'Drag & Drop or Click'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isLoaded ? 'Ready for analysis' : 'Excel (.xlsx) or CSV'}
            </p>
          </div>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 mt-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
