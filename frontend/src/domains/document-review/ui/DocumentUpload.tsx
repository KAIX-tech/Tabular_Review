'use client';

import React, { useCallback } from 'react';
import { Upload, FileText, FlaskConical } from '@/shared/ui/icons';
import { DocumentFile } from '../model/types';

interface DocumentUploadProps {
  onUpload: (files: DocumentFile[]) => void;
  onLoadSample?: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUpload, onLoadSample }) => {
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const fileList: File[] = Array.from(event.target.files);
      const processedFiles: DocumentFile[] = [];

      for (const file of fileList) {
        const content = await readFileAsBase64(file);
        processedFiles.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          content: content, // Base64 string (without data: prefix for easier handling if needed, but here we keep pure base64)
          mimeType: file.type || 'text/plain'
        });
      }
      onUpload(processedFiles);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="p-6 w-full max-w-2xl mx-auto">
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors relative group bg-white shadow-sm">
        <input 
          type="file" 
          multiple 
          accept=".pdf,.txt,.md,.json" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center space-y-4 text-slate-500 group-hover:text-indigo-600 transition-colors">
          <div className="bg-indigo-50 p-5 rounded-full group-hover:bg-indigo-100 transition-colors duration-300">
            <Upload className="w-10 h-10 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-xl text-slate-700">Drag & drop contracts here</p>
            <p className="text-sm opacity-70">Supports PDF, TXT, DOCX</p>
          </div>
        </div>
      </div>

      {onLoadSample && (
        <div className="mt-8 flex flex-col items-center">
          <div className="relative w-full flex items-center gap-4 mb-6">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Or try sample data</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
          
          <button 
            onClick={onLoadSample}
            className="group flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="p-2 bg-slate-100 group-hover:bg-emerald-100 rounded-lg transition-colors">
              <FlaskConical className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-800">Load PE Side Letter Dataset</p>
              <p className="text-xs text-slate-500 group-hover:text-emerald-600">Includes 10 docs & 4 extraction columns</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};