import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from "../../../config"; 
import { 
    X, Plus, ChevronRight, Activity, Database, GitCommit, 
    FileText, RefreshCw, Layers, LayoutPanelLeft 
} from 'lucide-react';

// --- CONFIG: MATCHED TO BACKEND 10 MODULES ---
const AVAILABLE_MODULES = [
  { id: "dp1", label: "Remove Duplicates", name: "remove_duplicates" },
  { id: "dp2", label: "Handle Missing Values", name: "impute" },
  { id: "dp3", label: "Outlier Removal", name: "outlier" },
  { id: "dp5", label: "Polynomial Features", name: "polynomial" },
  { id: "dp6", label: "Log Transform", name: "log" },
  { id: "dp7", label: "Encoding", name: "encode" },
  { id: "dp8", label: "Scaling", name: "scale" },
  { id: "dp9", label: "Normalization", name: "normalize" },
  { id: "dp10", label: "PCA", name: "pca" },
  { id: "dp_drop", label: "Drop Column", name: "drop" }
];

const getActionStyle = (action) => {
  const s = (action || "").toLowerCase();
  if (s.includes('drop')) return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' }; 
  if (s.includes('impute') || s.includes('missing')) return { bg: '#e0e7ff', text: '#1d4ed8', border: '#c7d2fe' }; 
  if (s.includes('scale') || s.includes('normal')) return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' }; 
  if (s.includes('encod')) return { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' }; 
  if (s.includes('log') || s.includes('outlier')) return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' }; 
  return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }; 
};

const AIPlanOverlay = ({ file, domain, initialPlan, explanation, onClose, onExecutionComplete }) => {
  const [viewStep, setViewStep] = useState('report'); 
  const [plan, setPlan] = useState({});
  const [summaryText, setSummaryText] = useState("");
  const [editorText, setEditorText] = useState(""); 
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (explanation) {
        if (typeof explanation === 'object') {
            setSummaryText(explanation.summary || "No assessment available.");
            setEditorText(explanation.strategy || "No strategy available.");
        } else {
            setSummaryText(explanation);
            setEditorText(explanation);
        }
    }
  }, [explanation]);

  useEffect(() => {
    if (initialPlan) normalizeAndSetPlan(initialPlan);
  }, [initialPlan]);

  const normalizeAndSetPlan = (rawPlan) => {
      const normalized = {};
      if (!rawPlan) return;
      Object.keys(rawPlan).forEach(key => {
        const item = rawPlan[key];
        normalized[key] = {
            steps: item.steps || (item.action ? [{ action: item.action, label: item.action, params: "auto" }] : []),
            reason: item.reason || "Standard domain-specific processing."
        };
      });
      setPlan(normalized);
  };

  const handleSyncTable = async () => {
      if (!editorText.trim()) return alert("Editor is empty.");
      setIsSyncing(true);
      const formData = new FormData();
      formData.append("dataset", file);
      formData.append("report", editorText); 
      formData.append("domain", domain); 

      try {
          const res = await axios.post(`${API_BASE_URL}/regenerate-plan`, formData);
          if (res.data.plan) {
            normalizeAndSetPlan(res.data.plan);
            setViewStep('plan');
          }
      } catch (err) {
          alert("Sync failed.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleRemoveStep = (col, idx) => {
    setPlan(prev => {
        const newSteps = [...prev[col].steps];
        newSteps.splice(idx, 1);
        return { ...prev, [col]: { ...prev[col], steps: newSteps } };
    });
  };

  const handleAddStep = (col, moduleId) => {
    const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
    if(!mod) return;
    setPlan(prev => ({
        ...prev,
        [col]: { 
            ...prev[col], 
            steps: [...prev[col].steps, { action: mod.name, label: mod.label, params: "auto" }] 
        }
    }));
  };

  const handleExecute = async () => {
    if (!file) return;
    setIsExecuting(true);
    try {
        const formData = new FormData();
        formData.append("dataset", file);
        formData.append("plan", JSON.stringify(plan));
        formData.append("domain", domain);
        const res = await axios.post(`${API_BASE_URL}/execute-approved-plan`, formData);
        if (onExecutionComplete) onExecutionComplete(res.data);
        onClose();
    } catch (error) {
        alert("Execution Failed");
    } finally {
        setIsExecuting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '95%', maxWidth: '1300px', height: '90vh', background: '#fff', borderRadius: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden' }}>
        
        {/* --- HEADER --- */}
        <div style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
            <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={24} color="#2563eb" /> {domain} AI Strategy Engine
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Precision Preprocessing Protocol</span>
                </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                <button onClick={() => setViewStep('report')} style={{ ...navBtnStyle, background: viewStep === 'report' ? '#fff' : 'transparent', color: viewStep === 'report' ? '#2563eb' : '#64748b', boxShadow: viewStep === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                   <FileText size={16} /> Summary
                </button>
                <button onClick={() => setViewStep('strategy')} style={{ ...navBtnStyle, background: viewStep === 'strategy' ? '#fff' : 'transparent', color: viewStep === 'strategy' ? '#2563eb' : '#64748b', boxShadow: viewStep === 'strategy' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                   <Layers size={16} /> Strategy
                </button>
                <button onClick={() => setViewStep('plan')} style={{ ...navBtnStyle, background: viewStep === 'plan' ? '#fff' : 'transparent', color: viewStep === 'plan' ? '#2563eb' : '#64748b', boxShadow: viewStep === 'plan' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                   <LayoutPanelLeft size={16} /> Config
                </button>
            </div>
        </div>

        {/* --- BODY (SCROLLABLE AREA) --- */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '30px' }}>
            
            {/* View 1: Summary */}
            {viewStep === 'report' && (
                <div style={{ maxWidth: '850px', margin: '0 auto', background: '#fff', padding: '40px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', minHeight: 'fit-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                         <FileText size={24} color="#3b82f6" />
                         <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{domain} Domain Assessment</h3>
                    </div>
                    <div style={{ lineHeight: '1.8', color: '#334155', fontSize: '15px', whiteSpace: 'pre-wrap' }}>{summaryText}</div>
                </div>
            )}

            {/* View 2: Strategy Editor */}
            {viewStep === 'strategy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                    <div style={{ flex: 1, background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <Layers size={18} color="#64748b" />
                                <span style={{ fontWeight: 'bold', color: '#475569', fontSize: '14px' }}>Strategy Document</span>
                            </div>
                            <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>EDITABLE</span>
                        </div>
                        <textarea
                            value={editorText}
                            onChange={(e) => setEditorText(e.target.value)}
                            style={{ flex: 1, border: 'none', padding: '25px', resize: 'none', fontSize: '14px', color: '#0f172a', fontFamily: 'monospace', lineHeight: '1.6', outline: 'none' }}
                        />
                    </div>
                    <button onClick={handleSyncTable} disabled={isSyncing} style={{ alignSelf: 'center', padding: '12px 40px', borderRadius: '12px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' }}>
                        {isSyncing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />} 
                        {isSyncing ? 'Processing...' : 'Sync Configuration'}
                    </button>
                </div>
            )}

            {/* View 3: Cards */}
            {viewStep === 'plan' && (
                <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
                    {Object.entries(plan).map(([col, details], idx) => (
                        <div key={idx} style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0', borderLeft: `6px solid ${getActionStyle(details.steps[0]?.action).text}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{col}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {details.steps.map((s, i) => {
                                        const st = getActionStyle(s.action);
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}`, padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {s.label}
                                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => handleRemoveStep(col, i)} />
                                                </div>
                                                {i < details.steps.length - 1 && <ChevronRight size={16} color="#cbd5e1" />}
                                            </div>
                                        );
                                    })}
                                    <div style={{ position: 'relative', marginLeft: '10px' }}>
                                        <select onChange={(e) => { if(e.target.value) handleAddStep(col, e.target.value); e.target.value=""; }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}>
                                            <option value="">+ Add</option>
                                            {AVAILABLE_MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                        <button style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
                                            <Plus size={14} style={{marginRight: '4px'}}/> Step
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
                                <GitCommit size={18} color="#94a3b8" style={{ marginTop: '2px' }} />
                                <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: '1.5' }}>"{details.reason}"</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* --- FOOTER --- */}
        <div style={{ padding: '20px 30px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
            <div style={{ display: 'flex', gap: '15px' }}>
                {viewStep === 'report' && <button onClick={() => setViewStep('strategy')} style={primaryBtnStyle}>Next: Define Strategy <ChevronRight size={18}/></button>}
                {viewStep === 'strategy' && <button onClick={() => setViewStep('plan')} style={primaryBtnStyle}>Next: Review Config <ChevronRight size={18}/></button>}
                {viewStep === 'plan' && (
                    <button onClick={handleExecute} disabled={isExecuting} style={{ ...primaryBtnStyle, background: isExecuting ? '#94a3b8' : '#059669' }}>
                        {isExecuting ? 'Executing...' : <><Database size={18} /> Execute Protocol</>}
                    </button>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

const navBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' };
const primaryBtnStyle = { padding: '14px 32px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' };

export default AIPlanOverlay;