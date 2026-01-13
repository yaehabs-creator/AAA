
import React, { useState, useEffect } from 'react';
import { Clause, TimeFrame, TimeFrameType, ObligationParty } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface AIAnalysisResult {
  clause_id: string;
  has_time_frames: boolean;
  time_frames: Array<{
    raw_text: string;
    numeric_value: number;
    unit: string;
    category: string;
    trigger_event: string;
    deadline_description: string;
  }>;
  particular_vs_general: {
    has_particular: boolean;
    effect_type: string;
    primary_risk_owner: string;
    short_explanation: string;
  };
  dashboard_summary: {
    headline: string;
    key_points: string[];
  };
}

interface ComparisonModalProps {
  baseClause: Clause;
  allClauses: Clause[];
  onClose: () => void;
  onUpdateClause: (updatedClause: Clause) => void;
  canEdit?: boolean;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ baseClause, allClauses, onClose, onUpdateClause, canEdit = true }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map AI categories to our defined TimeFrameType
  const mapCategoryToType = (category: string): TimeFrameType => {
    const cat = category.toUpperCase();
    if (cat.includes('NOTICE')) return 'NOTICE_PERIOD';
    if (cat.includes('PAYMENT')) return 'PAYMENT_PERIOD';
    if (cat.includes('PERFORMANCE')) return 'TIME_FOR_COMPLETION';
    if (cat.includes('DEFECT')) return 'DEFECTS_LIABILITY_PERIOD';
    if (cat.includes('EXTENSION')) return 'EXTENSION_OF_TIME';
    if (cat.includes('RESPONSE')) return 'RESPONSE_TIME';
    return 'GENERAL_DURATION';
  };

  const mapRiskToParty = (risk: string): ObligationParty => {
    if (risk.includes('Contractor')) return 'Contractor';
    if (risk.includes('Employer')) return 'Employer';
    if (risk.includes('Engineer') || risk.includes('Manager')) return 'Engineer/Project Manager';
    return 'Other/Unclear';
  };

  const analyzeClauseWithAI = async () => {
    setIsAnalyzing(true);
    setError(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';

    const systemInstruction = `
You are the Contract Intelligence Engine for the AAA Contract Department.
Your ONLY job is to analyze construction contract clauses and return a STRICT JSON object.

Rules:
- Use ONLY the text provided.
- Return ONLY valid JSON. No extra text.
`;

    const promptInput = {
      clause_id: `C.${baseClause.clause_number}`,
      clause_title: baseClause.clause_title,
      general_clause_text: baseClause.general_condition || baseClause.clause_text || "",
      particular_clause_text: baseClause.particular_condition || ""
    };

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: JSON.stringify(promptInput) }] }],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clause_id: { type: Type.STRING },
              has_time_frames: { type: Type.BOOLEAN },
              time_frames: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    raw_text: { type: Type.STRING },
                    numeric_value: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    category: { type: Type.STRING },
                    trigger_event: { type: Type.STRING },
                    deadline_description: { type: Type.STRING }
                  }
                }
              },
              particular_vs_general: {
                type: Type.OBJECT,
                properties: {
                  has_particular: { type: Type.BOOLEAN },
                  effect_type: { type: Type.STRING },
                  primary_risk_owner: { type: Type.STRING },
                  short_explanation: { type: Type.STRING }
                }
              },
              dashboard_summary: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  key_points: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      });

      const result: AIAnalysisResult = JSON.parse(response.text);
      setAnalysisResult(result);

      // Automatically add new analyzed timeframes to the clause's permanent state
      if (result.has_time_frames && result.time_frames.length > 0) {
        const newFrames: TimeFrame[] = result.time_frames.map(tf => ({
          original_phrase: tf.raw_text,
          type: mapCategoryToType(tf.category),
          applies_to: mapRiskToParty(result.particular_vs_general.primary_risk_owner),
          short_explanation: `${tf.trigger_event} - ${tf.deadline_description}`
        }));

        const currentFrames = baseClause.time_frames || [];
        // Filter out duplicates based on phrase
        const uniqueNewFrames = newFrames.filter(nf => !currentFrames.some(cf => cf.original_phrase === nf.original_phrase));
        
        if (uniqueNewFrames.length > 0) {
          onUpdateClause({
            ...baseClause,
            time_frames: [...currentFrames, ...uniqueNewFrames],
            has_time_frame: true
          });
        }
      }
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      setError("AI analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteTimeFrame = (index: number) => {
    if (!baseClause.time_frames) return;
    const updatedFrames = baseClause.time_frames.filter((_, i) => i !== index);
    onUpdateClause({
      ...baseClause,
      time_frames: updatedFrames,
      has_time_frame: updatedFrames.length > 0
    });
  };

  const getTimeTypeColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('PAYMENT')) return 'text-purple-600 bg-purple-50 border-purple-100';
    if (t.includes('NOTICE')) return 'text-orange-600 bg-orange-50 border-orange-100';
    if (t.includes('COMPLETION')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    return 'text-aaa-blue bg-aaa-bg border-aaa-blue/10';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-aaa-blue/90 backdrop-blur-xl animate-in fade-in">
      <div className="bg-white w-full max-w-[1650px] h-[95vh] rounded-[32px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-white/20">
        
        <div className="px-12 py-8 border-b border-aaa-border flex items-center justify-between bg-white shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-10">
             <div className="w-16 h-16 bg-aaa-blue rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-white font-black text-lg">AAA</span>
             </div>
             <div>
                <h3 className="text-4xl font-black text-aaa-blue tracking-tighter">Temporal Intelligence Ledger</h3>
                <div className="flex items-center gap-4 mt-2">
                   <div className="px-3 py-1 bg-aaa-bg rounded-lg border border-aaa-blue/10">
                      <span className="text-[11px] font-black text-aaa-blue mono">CLAUSE {baseClause.clause_number}</span>
                   </div>
                   <span className="text-aaa-muted font-bold text-sm">{baseClause.clause_title}</span>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            {error && <span className="text-red-500 text-[10px] font-bold uppercase animate-pulse">{error}</span>}
            <button 
              onClick={analyzeClauseWithAI}
              disabled={isAnalyzing || !canEdit}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 ${
                isAnalyzing || !canEdit ? 'bg-aaa-muted cursor-not-allowed text-white/50' : 'bg-aaa-blue text-white hover:bg-aaa-hover active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing AI Ledger...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyze & Save Timeframes
                </>
              )}
            </button>

            <button onClick={onClose} className="p-4 hover:bg-aaa-bg rounded-2xl transition-all border border-aaa-border hover:border-aaa-blue group">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="flex divide-x divide-aaa-border bg-slate-50/20 shrink-0 border-b border-aaa-border">
            <div className="w-2/3 flex divide-x divide-aaa-border">
              <div className="w-1/2 flex flex-col">
                <div className="px-8 py-3 bg-white/50 border-b border-aaa-border">
                  <span className="text-[10px] font-black text-aaa-blue uppercase tracking-widest">Baseline (GC)</span>
                </div>
                <div className="flex-1 p-10 font-mono text-[13px] leading-relaxed">
                  <div className="font-black text-aaa-blue mb-4 uppercase">{baseClause.clause_number} {baseClause.clause_title}</div>
                  {baseClause.general_condition ? (
                    <div dangerouslySetInnerHTML={{ __html: baseClause.general_condition }} className="verbatim-content" />
                  ) : baseClause.condition_type === 'General' ? (
                    <div dangerouslySetInnerHTML={{ __html: baseClause.clause_text }} className="verbatim-content" />
                  ) : (
                    <div className="h-40 flex items-center justify-center border-2 border-dashed border-aaa-border/50 rounded-2xl bg-white/50 text-[10px] font-black uppercase text-aaa-muted opacity-40">Not Present in Baseline</div>
                  )}
                </div>
              </div>
              <div className="w-1/2 flex flex-col bg-white">
                <div className="px-8 py-3 bg-white border-b border-aaa-border shadow-sm">
                  <span className="text-[10px] font-black text-aaa-accent uppercase tracking-widest">Modification (PC)</span>
                </div>
                <div className="flex-1 p-10 font-mono text-[13px] leading-relaxed">
                  <div className="font-black text-aaa-accent mb-4 uppercase">{baseClause.clause_number} {baseClause.clause_title}</div>
                  {baseClause.particular_condition ? (
                    <div dangerouslySetInnerHTML={{ __html: baseClause.particular_condition }} className="verbatim-content" />
                  ) : baseClause.condition_type === 'Particular' ? (
                    <div dangerouslySetInnerHTML={{ __html: baseClause.clause_text }} className="verbatim-content" />
                  ) : (
                    <div className="h-40 flex items-center justify-center border-2 border-dashed border-aaa-border/50 rounded-2xl bg-white/50 text-[10px] font-black uppercase text-aaa-muted opacity-40">No Particular Revision</div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-1/3 flex flex-col bg-slate-50 overflow-hidden">
               <div className="px-8 py-5 border-b border-aaa-border bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-aaa-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     <span className="text-[11px] font-black text-aaa-blue uppercase tracking-widest">Temporal Assets</span>
                  </div>
                  <span className="px-2 py-0.5 bg-aaa-blue/5 text-aaa-blue text-[9px] font-bold rounded">{(baseClause.time_frames || []).length} Frames</span>
               </div>
               
               <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
                  {(baseClause.time_frames || []).map((tf, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-aaa-border shadow-sm hover:border-aaa-blue transition-all group relative">
                       {canEdit && (
                         <button 
                           onClick={() => deleteTimeFrame(i)}
                           className="absolute top-4 right-4 p-2 text-aaa-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                           title="Remove Asset"
                         >
                           <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                         </button>
                       )}
                       <div className="flex items-center justify-between mb-4">
                          <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${getTimeTypeColor(tf.type)}`}>
                            {tf.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[9px] font-bold text-aaa-muted uppercase pr-8">{tf.applies_to}</span>
                       </div>
                       <div className="p-3 bg-aaa-bg rounded-lg border border-aaa-blue/5 mb-4">
                          <p className="text-[12px] font-mono font-bold text-aaa-blue leading-relaxed">"{tf.original_phrase}"</p>
                       </div>
                       <p className="text-[11px] font-semibold text-aaa-text leading-tight group-hover:text-aaa-blue transition-colors">{tf.short_explanation}</p>
                    </div>
                  ))}
                  {(!baseClause.time_frames || baseClause.time_frames.length === 0) && (
                    <div className="h-40 flex flex-col items-center justify-center opacity-40 text-center"><p className="text-xs font-black uppercase tracking-widest">No Temporal Nodes</p></div>
                  )}
               </div>
            </div>
          </div>

          {analysisResult && (
            <div className="p-12 bg-white animate-in slide-in-from-bottom-8 duration-500">
              <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex items-center gap-6 border-b border-aaa-border pb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-aaa-blue to-aaa-accent rounded-2xl flex items-center justify-center shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-3xl font-black text-aaa-blue tracking-tighter">AI Analysis Insights</h4>
                    <p className="text-[10px] font-bold text-aaa-muted uppercase tracking-[0.3em] mt-1">Deep Intelligence Layer v3.2</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-8">
                    <div>
                      <h5 className="text-[11px] font-black text-aaa-muted uppercase tracking-widest mb-4">Headline Overview</h5>
                      <p className="text-2xl font-black text-aaa-text leading-tight tracking-tight">
                        {analysisResult.dashboard_summary.headline}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-[11px] font-black text-aaa-muted uppercase tracking-widest mb-4">Key Observations</h5>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisResult.dashboard_summary.key_points.map((pt, i) => (
                          <li key={i} className="flex gap-4 p-4 bg-aaa-bg/30 rounded-2xl border border-aaa-border/50 text-[13px] font-semibold text-aaa-text leading-relaxed">
                            <div className="w-2 h-2 rounded-full bg-aaa-blue mt-1.5 shrink-0" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[32px] border border-aaa-border shadow-inner-soft space-y-8">
                    <h5 className="text-[11px] font-black text-aaa-blue uppercase tracking-widest mb-2">Modification Impact</h5>
                    
                    {analysisResult.particular_vs_general.has_particular ? (
                      <div className="space-y-6">
                        <div className="flex flex-wrap gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-aaa-muted uppercase px-1">Effect Type</span>
                            <span className="px-4 py-1.5 bg-aaa-blue text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md">
                              {analysisResult.particular_vs_general.effect_type}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-aaa-muted uppercase px-1">Risk Owner</span>
                            <span className="px-4 py-1.5 bg-white border border-aaa-blue text-aaa-blue rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm">
                              {analysisResult.particular_vs_general.primary_risk_owner}
                            </span>
                          </div>
                        </div>
                        <p className="text-[13px] font-medium text-aaa-muted leading-relaxed">
                          {analysisResult.particular_vs_general.short_explanation}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-black text-aaa-muted uppercase tracking-widest text-center py-10 opacity-40">
                        No Particular Condition revision for this clause.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-12 py-4 bg-aaa-blue text-white text-[10px] font-black uppercase tracking-[0.5em] flex justify-between items-center shrink-0">
          <span>AAA TEMPORAL EXTRACTION v2.5</span>
          <span className="opacity-60 uppercase">Temporal Assets Persisted in Ledger</span>
        </div>
      </div>
    </div>
  );
};
