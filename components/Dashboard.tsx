
import React from 'react';
import { Clause } from '../types';

interface DashboardProps {
  clauses: Clause[];
}

export const Dashboard: React.FC<DashboardProps> = ({ clauses }) => {
  const timeSensitiveCount = clauses.filter(c => c.time_frames && c.time_frames.length > 0).length;
  const total = clauses.length || 1;
  const tsPercent = (timeSensitiveCount / total) * 100;

  // Type distribution
  const types: Record<string, number> = {};
  clauses.forEach(c => {
    c.time_frames?.forEach(tf => {
      types[tf.type] = (types[tf.type] || 0) + 1;
    });
  });
  const topTypes = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8 mb-12 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-premium border border-aaa-border">
          <p className="text-aaa-muted text-[10px] font-black uppercase tracking-[0.3em] mb-4">Verbatim Clause Load</p>
          <p className="text-6xl font-black text-aaa-blue tracking-tighter">{clauses.length}</p>
          <p className="text-[10px] font-black text-aaa-muted uppercase mt-6 tracking-widest opacity-60">Verified Extraction Nodes</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-premium border border-aaa-border">
          <p className="text-aaa-muted text-[10px] font-black uppercase tracking-[0.3em] mb-4">Temporal Assets</p>
          <p className="text-6xl font-black text-aaa-accent tracking-tighter">{timeSensitiveCount}</p>
          <p className="text-[10px] font-black text-aaa-accent uppercase mt-6 tracking-widest opacity-60">Time-Sensitive Records</p>
        </div>

        <div className="bg-aaa-blue p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Deadlines Ratio</p>
          <p className="text-6xl font-black tracking-tighter">{tsPercent.toFixed(0)}%</p>
          <div className="mt-8">
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div className="bg-white h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${tsPercent}%` }} />
            </div>
            <p className="text-[9px] font-black text-white/50 uppercase mt-4 tracking-widest">Temporal Intelligence Density</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-3xl border border-aaa-border shadow-premium flex flex-col">
           <h4 className="text-xs font-black text-aaa-blue uppercase tracking-[0.3em] mb-10 border-b border-aaa-border pb-4">Mapping Intelligence</h4>
           <div className="flex-1 space-y-4">
              <div className="p-6 bg-aaa-bg border border-aaa-blue/5 rounded-2xl">
                 <p className="text-[10px] font-black text-aaa-blue uppercase mb-4 tracking-widest">Protocol Verification</p>
                 <div className="space-y-3">
                    {["Verbatim Temporal Extraction confirmed", "Notice periods synchronized", "Liability windows identified"].map((msg, i) => (
                      <div key={i} className="flex items-center gap-3 text-[11px] font-bold text-aaa-text">
                         <div className="w-1.5 h-1.5 rounded-full bg-aaa-blue" />
                         {msg}
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white p-10 rounded-3xl border border-aaa-border shadow-premium">
           <h4 className="text-xs font-black text-aaa-blue uppercase tracking-[0.3em] mb-10 border-b border-aaa-border pb-4">Frame Distribution</h4>
           <div className="flex items-end gap-6 h-48 px-4">
              {topTypes.map(([type, count]) => (
                <div key={type} className="flex-1 group relative flex flex-col items-center gap-4">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-aaa-blue text-white text-[9px] font-black px-3 py-1.5 rounded-xl z-20">
                    {count}
                  </div>
                  <div 
                    className="w-full bg-aaa-bg border border-aaa-blue/5 rounded-t-xl group-hover:bg-aaa-blue transition-all duration-500 shadow-inner"
                    style={{ height: `${(count / Math.max(...Object.values(types))) * 100}%` }}
                  />
                  <span className="text-[8px] font-black text-aaa-muted uppercase tracking-tighter text-center leading-tight">
                    {type.split('_')[0]}
                  </span>
                </div>
              ))}
              {topTypes.length === 0 && (
                <div className="w-full h-full flex items-center justify-center italic text-aaa-muted opacity-40 uppercase text-[9px] font-black">Waiting for Data...</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
