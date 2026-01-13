
import React, { useState } from 'react';

interface AddClauseModalProps {
  onClose: () => void;
  onSave: (clauseData: {
    number: string;
    title: string;
    generalText: string;
    particularText: string;
    contractId: string;
  }) => Promise<void>;
  contractId: string;
}

export const AddClauseModal: React.FC<AddClauseModalProps> = ({ onClose, onSave, contractId }) => {
  const [formData, setFormData] = useState({
    number: '',
    title: '',
    generalText: '',
    particularText: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.number.trim()) newErrors.number = "Clause number is required";
    if (!formData.generalText.trim() && !formData.particularText.trim()) {
      newErrors.text = "At least one condition text is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        number: formData.number,
        title: formData.title,
        generalText: formData.generalText,
        particularText: formData.particularText,
        contractId: contractId
      });
      onClose();
    } catch (err) {
      console.error("Manual Injection Failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-aaa-blue/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-white/20">
        
        {/* Header */}
        <div className="px-10 py-8 border-b border-aaa-border flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-aaa-blue rounded-xl flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-aaa-blue tracking-tighter leading-tight">Append Clause Node</h3>
              <p className="text-[10px] font-bold text-aaa-muted uppercase tracking-[0.2em] mt-1">Dual Verbatim Injection</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-aaa-bg rounded-xl transition-all border border-aaa-border group">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-aaa-muted group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-aaa-blue uppercase tracking-widest px-1">Clause Number *</label>
              <input 
                type="text"
                placeholder="e.g. 14.1"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
                className={`w-full px-5 py-4 bg-aaa-bg/30 border rounded-2xl font-mono text-sm focus:ring-4 focus:ring-aaa-blue/5 outline-none transition-all ${errors.number ? 'border-red-500' : 'border-aaa-border focus:border-aaa-blue'}`}
              />
              {errors.number && <p className="text-[9px] font-bold text-red-500 uppercase px-1">{errors.number}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-aaa-blue uppercase tracking-widest px-1">Clause Title</label>
              <input 
                type="text"
                placeholder="Heading text..."
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-5 py-4 bg-aaa-bg/30 border border-aaa-border rounded-2xl font-semibold text-sm focus:border-aaa-blue focus:ring-4 focus:ring-aaa-blue/5 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-aaa-blue uppercase tracking-widest px-1">Baseline: General Conditions</label>
              <textarea 
                placeholder="Paste baseline verbatim text here..."
                value={formData.generalText}
                onChange={(e) => setFormData({...formData, generalText: e.target.value})}
                rows={10}
                className="w-full px-6 py-5 bg-aaa-bg/30 border border-aaa-border rounded-2xl font-mono text-[13px] leading-relaxed focus:ring-4 focus:ring-aaa-blue/5 focus:border-aaa-blue outline-none transition-all custom-scrollbar"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-aaa-accent uppercase tracking-widest px-1">Revision: Particular Conditions</label>
              <textarea 
                placeholder="Paste modification verbatim text here..."
                value={formData.particularText}
                onChange={(e) => setFormData({...formData, particularText: e.target.value})}
                rows={10}
                className="w-full px-6 py-5 bg-aaa-bg/30 border border-aaa-border rounded-2xl font-mono text-[13px] leading-relaxed focus:ring-4 focus:ring-aaa-accent/5 focus:border-aaa-accent outline-none transition-all custom-scrollbar"
              />
            </div>
          </div>
          {errors.text && <p className="text-center text-[10px] font-black text-red-500 uppercase">{errors.text}</p>}
        </form>

        {/* Footer Actions */}
        <div className="px-10 py-8 border-t border-aaa-border bg-slate-50/50 flex items-center justify-end gap-4 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-8 py-4 text-[10px] font-black text-aaa-muted uppercase tracking-widest hover:text-aaa-blue transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-12 py-4 bg-aaa-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-aaa-hover transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            {isSubmitting ? 'Syncing...' : 'Save Dual Clause'}
            {!isSubmitting && <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </button>
        </div>
      </div>
    </div>
  );
};
