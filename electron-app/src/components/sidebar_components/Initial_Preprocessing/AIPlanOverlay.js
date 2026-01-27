import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from "../../../config"; 

// Markdown Renderer
const MarkdownRenderer = ({ text }) => (
  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#444', fontSize: '13px' }}>
    {text && text.split('\n').map((line, i) => {
      if (line.startsWith('###')) return <h4 key={i} style={{color:'#2c3e50', marginTop:'15px'}}>{line.replace(/#/g, '')}</h4>;
      if (line.startsWith('**')) return <p key={i} style={{fontWeight:'bold'}}>{line.replace(/\*\*/g, '')}</p>;
      return <p key={i} style={{marginBottom:'5px'}}>{line}</p>;
    })}
  </div>
);

// Action Badge Colors
const getActionColor = (action) => {
  switch (action) {
    case 'drop': return { bg: '#ffebee', text: '#c62828', border: '#ffcdd2' }; 
    case 'impute': return { bg: '#e3f2fd', text: '#1565c0', border: '#bbdefb' };
    case 'scale': return { bg: '#e8f5e9', text: '#2e7d32', border: '#c8e6c9' }; 
    case 'one_hot_encode': return { bg: '#fff3e0', text: '#ef6c00', border: '#ffe0b2' };
    case 'label_encode': return { bg: '#f3e5f5', text: '#6a1b9a', border: '#e1bee7' };
    default: return { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' };
  }
};

const AIPlanOverlay = ({ 
    file, 
    initialPlan, 
    explanation, // Expecting object: { summary, strategy }
    onClose, 
    onExecutionComplete 
}) => {
  const [viewStep, setViewStep] = useState('report'); // 'report' = Step 1, 'plan' = Step 2
  const [plan, setPlan] = useState({});
  
  // State for text content
  const [summaryText, setSummaryText] = useState("Loading summary...");
  const [editorText, setEditorText] = useState("Loading strategy...");
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- INITIALIZATION EFFECTS ---

  useEffect(() => {
    // Robustly handle the explanation prop
    if (explanation) {
        if (typeof explanation === 'object') {
            setSummaryText(explanation.summary || "No clinical summary provided.");
            setEditorText(explanation.strategy || "No technical strategy provided.");
        } else {
            // Legacy fallback if backend sends plain string
            setSummaryText(explanation);
            setEditorText(explanation);
        }
    }
  }, [explanation]);

  useEffect(() => {
    if (initialPlan) normalizeAndSetPlan(initialPlan);
  }, [initialPlan]);

  // --- HELPER FUNCTIONS ---

  const normalizeAndSetPlan = (rawPlan) => {
      const normalized = {};
      if (!rawPlan) return;
      
      Object.keys(rawPlan).forEach(key => {
        const item = rawPlan[key];
        let action = item.action ? item.action.toLowerCase().trim() : 'drop';
        
        // Standardize action names
        if (action.includes('label')) action = 'label_encode';
        else if (action.includes('one_hot')) action = 'one_hot_encode';
        else if (action.includes('scale')) action = 'scale';
        else if (action.includes('impute')) action = 'impute';
        else if (action.includes('drop')) action = 'drop';
        
        normalized[key] = {
          ...item,
          action: action,
          params: action === 'impute' && !item.params ? 'mean' : item.params
        };
      });
      setPlan(normalized);
  };

  const handleActionChange = (column, newAction) => {
    setPlan(prev => ({
      ...prev,
      [column]: { 
        ...prev[column], 
        action: newAction,
        params: newAction === 'impute' ? 'mean' : undefined
      }
    }));
  };

  // --- API HANDLERS ---

  const handleSyncTable = async () => {
      if (!editorText || !editorText.trim()) {
          alert("The strategy editor is empty. Cannot sync.");
          return;
      }

      setIsSyncing(true);
      const formData = new FormData();
      formData.append("dataset", file);
      // Send the Edited Technical Strategy to Phase 3 (JSON Mapper)
      formData.append("report", editorText); 

      try {
          const res = await axios.post(`${API_BASE_URL}/regenerate-plan`, formData);
          
          // Use res.data.plan directly if the structure matches
          if (res.data.plan) {
            normalizeAndSetPlan(res.data.plan);
          } else {
            alert("Sync failed: Backend returned empty plan.");
          }
      } catch (err) {
          console.error("Sync Error:", err);
          alert("Failed to sync table. Check console for details.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleExecute = async () => {
    if (!file) return;
    setIsExecuting(true);
    
    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("plan", JSON.stringify(plan));

    try {
        const res = await axios.post(`${API_BASE_URL}/execute-approved-plan`, formData);
        if (onExecutionComplete) {
            onExecutionComplete(res.data);
        }
        onClose();
    } catch (error) {
        console.error("Execution Error:", error);
        alert("Failed to execute plan. Please check backend logs.");
    } finally {
        setIsExecuting(false);
    }
  };

  if (!plan || Object.keys(plan).length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(9, 30, 66, 0.7)', zIndex: 10000, 
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(8px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '95%', height: '92%', backgroundColor: '#fff', borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* HEADER */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #dfe1e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f4f5f7' }}>
          <div>
            <h2 style={{ margin: 0, color: '#172b4d', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>🤖</span> AI Clinical Strategy Engine
            </h2>
            <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>
              {viewStep === 'report' ? 'Step 1: Clinical Safety & Feasibility Assessment' : 'Step 2: Technical Configuration & Strategy'}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: '#42526e' }}>×</button>
        </div>

        {/* CONTENT AREA */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#fafbfc', position: 'relative' }}>
            
            {/* >>> VIEW 1: EXECUTIVE SUMMARY (Read Only) <<< */}
            {viewStep === 'report' && (
                <div style={{ width: '100%', padding: '30px', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #dfe1e6' }}>
                        <h3 style={{marginTop:0, color:'#0052cc', borderBottom: '2px solid #0052cc', paddingBottom: '10px', display: 'inline-block'}}>
                            Clinical Executive Summary
                        </h3>
                        <div style={{ marginTop: '20px' }}>
                            <MarkdownRenderer text={summaryText} />
                        </div>
                    </div>
                </div>
            )}

            {/* >>> VIEW 2: SPLIT CONFIGURATION (Table + Editor) <<< */}
            {viewStep === 'plan' && (
                <>
                    {/* LEFT: TABLE */}
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #dfe1e6', backgroundColor: '#fff' }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                            <h4 style={{ margin:0, color:'#42526e', fontSize:'13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Column Actions Map</h4>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize:'13px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#f4f5f7', zIndex: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <tr>
                                        <th style={{ padding:'12px 15px', textAlign:'left', color:'#5e6c84', width: '25%' }}>Column</th>
                                        <th style={{ padding:'12px 15px', textAlign:'left', color:'#5e6c84', width: '25%' }}>Action</th>
                                        <th style={{ padding:'12px 15px', textAlign:'left', color:'#5e6c84' }}>Clinical Logic</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {Object.entries(plan).map(([col, details], idx) => {
                                    const styles = getActionColor(details.action);
                                    return (
                                        <tr key={col} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                            <td style={{ padding:'12px 15px', fontWeight:'500', color: '#172b4d' }}>{col}</td>
                                            <td style={{ padding:'12px 15px' }}>
                                                  <div style={{ position: 'relative', width: '100%' }}>
                                                    <select 
                                                        value={details.action} 
                                                        onChange={(e) => handleActionChange(col, e.target.value)} 
                                                        disabled={isExecuting}
                                                        style={{ 
                                                            appearance: 'none', width:'100%', padding:'6px 12px', 
                                                            borderRadius:'100px', border:`1px solid ${styles.border}`, 
                                                            backgroundColor:styles.bg, color:styles.text, 
                                                            fontSize:'12px', fontWeight:'600', cursor: 'pointer', textAlign: 'center'
                                                        }}
                                                    >
                                                        <option value="drop">Drop</option>
                                                        <option value="impute">Impute (Mean)</option>
                                                        <option value="scale">Scale (Std)</option>
                                                        <option value="one_hot_encode">One-Hot</option>
                                                        <option value="label_encode">Label</option>
                                                    </select>
                                                  </div>
                                            </td>
                                            <td style={{ padding:'12px 15px', color:'#6b778c', lineHeight: '1.4' }}>{details.reason}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RIGHT: EDITOR */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', backgroundColor: '#f4f5f7', position: 'relative' }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #dfe1e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin:0, color:'#42526e', fontSize:'13px', textTransform: 'uppercase' }}>Detailed Technical Strategy</h4>
                            <span style={{ fontSize:'11px', background:'#e3f2fd', color:'#0052cc', padding:'2px 8px', borderRadius:'10px', fontWeight: 'bold' }}>Editable</span>
                        </div>
                        
                        <div style={{ flex: 1, padding: '15px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dfe1e6', borderRadius: '8px', overflow: 'hidden' }}>
                                <textarea
                                    value={editorText}
                                    onChange={(e) => setEditorText(e.target.value)}
                                    placeholder="The detailed technical strategy will appear here..."
                                    style={{ 
                                        flex: 1, width: '100%', border: 'none', padding: '15px', 
                                        resize: 'none', fontSize: '13px', lineHeight: '1.6', 
                                        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace', 
                                        outline: 'none', color: '#172b4d' 
                                    }}
                                />
                                <div style={{ padding: '8px 12px', background: '#fafbfc', borderTop: '1px solid #eee', fontSize: '11px', color: '#6b778c' }}>
                                    💡 Tip: You can edit this text. Click "Sync Table" to update the JSON map based on your edits.
                                </div>
                            </div>

                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                <button 
                                    onClick={handleSyncTable} 
                                    disabled={isSyncing} 
                                    style={{ 
                                        padding: '10px', borderRadius: '6px', border: '1px solid #b3d4ff', 
                                        backgroundColor: '#deebff', color: '#0052cc', fontWeight: '600', 
                                        cursor: isSyncing ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    {isSyncing ? 'Processing Updates...' : '⚡ Sync Table with Changes'}
                                </button>
                                
                                <button 
                                    onClick={handleExecute} 
                                    disabled={isExecuting} 
                                    style={{ 
                                        padding: '12px', borderRadius: '6px', border: 'none', 
                                        background: 'linear-gradient(135deg, #0052cc 0%, #0747a6 100%)', 
                                        color: 'white', fontWeight: '600', cursor: isExecuting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 6px rgba(0,82,204,0.2)',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    {isExecuting ? 'Building Pipeline...' : '🚀 Confirm & Execute Plan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* FOOTER */}
        {viewStep === 'report' && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #dfe1e6', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f4f5f7' }}>
                <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #dfe1e6', background: '#fff', color: '#42526e', cursor: 'pointer', fontWeight: '500' }}>Cancel</button>
                <button 
                    onClick={() => setViewStep('plan')} 
                    style={{ 
                        padding: '10px 24px', backgroundColor: '#0052cc', color: '#fff', 
                        border:'none', borderRadius:'6px', cursor:'pointer', fontWeight: '600',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    Proceed to Configuration →
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AIPlanOverlay;