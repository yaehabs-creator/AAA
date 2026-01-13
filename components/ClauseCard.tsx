
import React, { useState } from 'react';
import { Clause } from '../types';

interface ClauseCardProps {
  clause: Clause;
  onCompare?: (clause: Clause) => void;
  isCompareTarget?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
}

export const ClauseCard: React.FC<ClauseCardProps> = ({ clause, onCompare, isCompareTarget, canEdit, canDelete, onDelete }) => {
  const isDual = !!clause.general_condition || !!clause.particular_condition;
  const textLength = clause.clause_text?.length || 0;
  const [isCollapsed, setIsCollapsed] = useState(textLength > 1200);
  const [copied, setCopied] = useState(false);
  
  const modCount = clause.comparison?.length || 0;

  const handleCopy = () => {
    const temp = document.createElement("div");
    temp.innerHTML = clause.clause_text;
    const cleanText = temp.textContent || temp.innerText || "";
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id={`clause-${clause.clause_number}`}
      className={`relative group bg-white border rounded-3xl shadow-premium transition-all duration-500 hover:shadow-2xl overflow-hidden ${
        isCompareTarget ? 'border-aaa-blue ring-4 ring-aaa-blue/10 scale-[1.01]' : 'border-aaa-border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between px-10 py-6 border-b border-aaa-border bg-slate-50/30">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-aaa-muted mb-2">Matrix Coordinate</span>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-aaa-blue rounded-lg shadow-lg">
                  <span className="text-xl font-black text-white tracking-tighter mono">C.{clause.clause_number}</span>
               </div>
               <h3 className="text-2xl font-black text-aaa-text tracking-tight group-hover:text-aaa-blue transition-colors">{clause.clause_title}</h3>
            </div>
          </div>
          <div className="hidden sm:block h-10 w-px bg-aaa-border mx-2" />
          <div className="flex flex-wrap gap-2">
            <span className={`px-4 py-1 text-[9px] font-black rounded-full uppercase tracking-widest border ${
              clause.condition_type === 'General' ? 'bg-white text-aaa-blue border-aaa-blue/30 shadow-sm' : 'bg-aaa-accent text-white border-none shadow-lg'
            }`}>
              {clause.condition_type} Dataset
            </span>
            {modCount > 0 && (
              <span className="px-3 py-1 bg-aaa-text text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg">
                {modCount} Modifications
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCopy} className="p-3 bg-white border border-aaa-border text-aaa-muted hover:text-aaa-blue hover:border-aaa-blue rounded-xl transition-all shadow-sm group/copy relative">
            {copied ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1" /></svg>}
          </button>
          {onCompare && (
            <button onClick={() => onCompare(clause)} className="px-8 py-3 bg-aaa-blue text-white hover:bg-aaa-hover text-[10px] font-black rounded-xl transition-all uppercase tracking-widest shadow-xl flex items-center gap-3">
              Intelligence View
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          {canDelete && onDelete && (
            <button 
              onClick={onDelete}
              className="p-3 bg-red-50 border border-red-200 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all shadow-sm"
              title="Delete clause"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-aaa-border">
          {/* Baseline Side */}
          <div className="p-10 bg-aaa-bg/10">
            <div className="flex items-center justify-between mb-6">
               <span className="text-[10px] font-black text-aaa-muted uppercase tracking-[0.2em]">Baseline: General Conditions</span>
            </div>
            <div className={`font-mono text-[13px] leading-[1.8] text-aaa-text whitespace-pre-wrap transition-all duration-700 overflow-hidden ${isCollapsed ? 'max-h-[350px]' : 'max-h-none'}`}>
              <div className="font-extrabold text-aaa-blue mb-4 border-b border-aaa-blue/5 pb-2">{clause.clause_number} {clause.clause_title}</div>
              {clause.general_condition ? (
                <div dangerouslySetInnerHTML={{ __html: clause.general_condition }} className="verbatim-content" />
              ) : (
                <div className="h-20 flex items-center justify-center border-2 border-dashed border-aaa-border/50 rounded-2xl bg-white/50 text-[10px] font-black uppercase text-aaa-muted opacity-40">Not Present in Baseline</div>
              )}
            </div>
          </div>

          {/* Modification Side */}
          <div className="p-10 bg-aaa-bg/40">
            <div className="flex items-center justify-between mb-6">
               <span className="text-[10px] font-black text-aaa-muted uppercase tracking-[0.2em]">Revision: Particular Conditions</span>
            </div>
            <div className={`font-mono text-[13px] leading-[1.8] text-aaa-text whitespace-pre-wrap font-medium transition-all duration-700 overflow-hidden ${isCollapsed ? 'max-h-[350px]' : 'max-h-none'}`}>
              <div className="font-extrabold text-aaa-blue mb-4 border-b border-aaa-blue/5 pb-2">{clause.clause_number} {clause.clause_title}</div>
              {clause.particular_condition ? (
                <div dangerouslySetInnerHTML={{ __html: clause.particular_condition }} className="verbatim-content" />
              ) : clause.condition_type === 'Particular' ? (
                <div dangerouslySetInnerHTML={{ __html: clause.clause_text }} className="verbatim-content" />
              ) : (
                <div className="h-20 flex items-center justify-center border-2 border-dashed border-aaa-border/50 rounded-2xl bg-white/50 text-[10px] font-black uppercase text-aaa-muted opacity-40">No Particular Revision</div>
              )}
            </div>
          </div>
        </div>

        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-48 flex items-end justify-center pb-10 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
            <button onClick={() => setIsCollapsed(false)} className="px-12 py-4 bg-aaa-blue text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl pointer-events-auto hover:scale-105 transition-all">Expand Full Verbatim Data</button>
          </div>
        )}
      </div>
    </div>
  );
};
