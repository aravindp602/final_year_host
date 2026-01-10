import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AIPlanOverlay = ({ 
    file, 
    initialPlan, 
    explanation, 
    onUpdate, 
    onClose, 
    onExecutionComplete // Callback when API finishes successfully
}) => {
  const [plan, setPlan] = useState(initialPlan);
  const [isEditing, setIsEditing] = useState(false);
  const [editedExplanation, setEditedExplanation] = useState("");
  
  // Local loading state for the execution button
  const [isExecuting, setIsExecuting] = useState(false);

  // Load explanation into state
  useEffect(() => {
    if (explanation) {
      setEditedExplanation(explanation);
    }
  }, [explanation]);

  // Update local state when prop changes
  useEffect(() => {
    setPlan(initialPlan);
    setIsEditing(false);
  }, [initialPlan]);

  const handleActionChange = (column, newAction) => {
    const updatedPlan = {
      ...plan,
      [column]: {
        ...plan[column],
        action: newAction,
      },
    };
    setPlan(updatedPlan);
    if (onUpdate) {
      onUpdate(updatedPlan);
    }
    setIsEditing(true);
  };
  
  const handleExplanationChange = (e) => {
      setEditedExplanation(e.target.value);
      setIsEditing(true);
  }

  // --- NEW: Handle Execution Logic Inside Overlay ---
  const handleExecute = async () => {
    if (!file) {
        alert("No file found to process.");
        return;
    }

    setIsExecuting(true);
    console.log("✅ [AIPlanOverlay] Executing Plan...", plan);

    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("plan", JSON.stringify(plan));

    try {
        const res = await axios.post("http://localhost:5001/execute-approved-plan", formData);
        
        console.log("✅ [AIPlanOverlay] Execution Success:", res.data);
        
        // Notify parent (Sidebar) with the result
        if (onExecutionComplete) {
            onExecutionComplete(res.data);
        }
        
    } catch (error) {
        console.error("❌ Error executing approved plan:", error);
        alert("Failed to execute the plan. Check console for details.");
    } finally {
        setIsExecuting(false);
    }
  };
  // --------------------------------------------------

  if (!plan || Object.keys(plan).length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', 
      zIndex: 10000, 
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(3px)' 
    }}>
      
      <div style={{
        width: '80%',
        height: '85%',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>

        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#faf7fb'
        }}>
          <h2 style={{ margin: 0, color: '#b730cfff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🏥 AI Clinical Data Plan
          </h2>
          <button 
            onClick={onClose}
            disabled={isExecuting}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              fontWeight: 'bold',
              opacity: isExecuting ? 0.5 : 1
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', gap: '20px' }}>
          
          {/* Left Column: The Plan Table */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#555' }}>Preprocessing Actions</h4>
            <div style={{ 
              border: '1px solid #e0c8e6', 
              borderRadius: '8px', 
              flex: 1,
              overflow: 'auto',
              backgroundColor: '#fff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', borderBottom: '2px solid #ddd', zIndex: 2 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '15px', color: '#555' }}>Column Name</th>
                    <th style={{ textAlign: 'left', padding: '15px', color: '#555' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '15px', color: '#555' }}>Clinical Logic</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(plan).map(([column, details]) => (
                    <tr key={column} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '15px', fontWeight: '600', color: '#333' }}>{column}</td>
                      <td style={{ padding: '15px' }}>
                        <select
                          value={details.action}
                          onChange={(e) => handleActionChange(column, e.target.value)}
                          disabled={isExecuting}
                          style={{ 
                            padding: '8px', 
                            borderRadius: '6px', 
                            border: '1px solid #ccc',
                            backgroundColor: details.action === 'drop' ? '#fff1f0' : '#f0f9ff',
                            color: details.action === 'drop' ? '#d9534f' : '#000',
                            fontWeight: '500',
                            width: '100%'
                          }}
                        >
                          <option value="drop">Drop</option>
                          <option value="scale">Scale (Standardize)</option>
                          <option value="one_hot_encode">One-Hot Encode</option>
                          <option value="label_encode">Label Encode</option>
                        </select>
                      </td>
                      <td style={{ padding: '15px', color: '#666', lineHeight: '1.5', fontStyle: 'italic' }}>
                        {details.reason || "No specific reason provided."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Explanation & Action */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#555' }}>Clinical Rationale (Editable)</h4>
            <textarea
              value={editedExplanation}
              onChange={handleExplanationChange}
              disabled={isExecuting}
              placeholder="AI explanation will appear here..."
              style={{
                flex: 1,
                width: '100%',
                boxSizing: 'border-box',
                resize: 'none',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#333',
                padding: '15px',
                backgroundColor: '#fff',
                border: '1px solid #e0c8e6',
                borderRadius: '8px',
                fontFamily: 'inherit',
                marginBottom: '20px'
              }}
            />
            
            <button
              onClick={handleExecute} // Call the local execute function
              disabled={isExecuting}
              style={{
                width: '100%',
                padding: '15px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: isExecuting ? '#6c757d' : '#28a745',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: isExecuting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                transition: 'background 0.2s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseOver={(e) => !isExecuting && (e.target.style.backgroundColor = '#218838')}
              onMouseOut={(e) => !isExecuting && (e.target.style.backgroundColor = '#28a745')}
            >
              {isExecuting ? (
                  <>
                    <span style={{ 
                        width: '16px', height: '16px', 
                        border: '3px solid #fff', borderTopColor: 'transparent', borderRadius: '50%',
                        display: 'inline-block', animation: 'spin 1s linear infinite'
                    }} />
                    Processing...
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </>
              ) : (
                  isEditing ? 'Approve & Execute Updated Plan' : 'Execute Plan'
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AIPlanOverlay;