import React, { useState, useMemo, useEffect } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

// --- 1. CONFIGURATION: MAP MULTIPLE KEYS TO ONE COLUMN HEADER ---
const METRIC_MAPPING = {
  "Algorithm": ["algo", "algorithm", "model", "model_name"],
  "Clusters (K)": ["n_clusters", "best_k", "k", "num_clusters", "clusters"],
  "Silhouette Score": ["silhouette", "silhouette_score", "sil_score"],
  "Calinski-Harabasz": ["calinski", "calinski_harabasz_score", "ch_score"],
  "Davies-Bouldin": ["davies", "davies_bouldin_score", "db_score"],
  "Accuracy": ["accuracy", "acc"],
  "F1 Score": ["f1", "f1_score"]
};

export const ResultsPanel = ({ data, onClose }) => {
  const [viewingBranch, setViewingBranch] = useState(null);

  // ---------------------------------------------------------
  // 🔍 DEBUGGING SECTION START
  // ---------------------------------------------------------
  useEffect(() => {
    if (!data) return;
    
    console.group("🚀 [ResultsPanel Debugger]");
    console.log("1. Full Data Object:", data);

    if (data.main) {
        const rawMetrics = data.main.trainingResults?.[0]?.metrics;
        console.log("2. 'main' Branch Raw Metrics:", rawMetrics);
        
        if (rawMetrics) {
            console.log("3. Keys available in 'main':", Object.keys(rawMetrics));
            
            // Check if our mapping works
            const mappedAlgo = METRIC_MAPPING["Algorithm"].find(k => rawMetrics[k] !== undefined);
            const mappedK = METRIC_MAPPING["Clusters (K)"].find(k => rawMetrics[k] !== undefined);
            
            console.log(`4. Mapping Check for 'main':`);
            console.log(`   - Algorithm found? ${mappedAlgo ? "✅ (" + mappedAlgo + ")" : "❌ (Check Python output)"}`);
            console.log(`   - Clusters (K) found? ${mappedK ? "✅ (" + mappedK + ")" : "❌ (Check Python output)"}`);
        } else {
            console.warn("⚠️ 'main' branch has no metrics object!");
        }
    } else {
        console.log("ℹ️ No 'main' branch found in data.");
    }
    console.groupEnd();
  }, [data]);
  // ---------------------------------------------------------
  // 🔍 DEBUGGING SECTION END
  // ---------------------------------------------------------

  const branches = useMemo(() => {
    return Object.keys(data || {}).sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
  }, [data]);

  // --- HELPER: Get Normalized Metrics for a Branch ---
  const getNormalizedMetrics = (branchKey) => {
    const branch = data[branchKey];
    if (!branch?.trainingResults || branch.trainingResults.length === 0) return {};
    
    const rawMetrics = branch.trainingResults[0].metrics || {};
    const normalized = {};

    // 1. Process known mappings
    Object.entries(METRIC_MAPPING).forEach(([displayName, potentialKeys]) => {
      for (const key of potentialKeys) {
        if (rawMetrics[key] !== undefined) {
          normalized[displayName] = rawMetrics[key];
          break; // Found a value, stop looking for this metric
        }
      }
    });

    // 2. Add any other keys that weren't in our mapping (custom metrics)
    const allMappedKeys = Object.values(METRIC_MAPPING).flat();
    Object.keys(rawMetrics).forEach(key => {
      if (!allMappedKeys.includes(key)) {
        // Capitalize first letter for nicer display
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        normalized[displayKey] = rawMetrics[key];
      }
    });

    return normalized;
  };

  // --- HELPER: Get unique headers based on NORMALIZED keys ---
  const allMetricHeaders = useMemo(() => {
    const headers = new Set();
    branches.forEach(branch => {
      const metrics = getNormalizedMetrics(branch);
      Object.keys(metrics).forEach(k => headers.add(k));
    });
    
    // Custom sort order: Put Algorithm and Clusters first, others alphabetically
    const priority = ["Algorithm", "Clusters (K)", "Silhouette Score", "Calinski-Harabasz", "Davies-Bouldin"];
    return Array.from(headers).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [data, branches]);


  if (!data || branches.length === 0) return null;

  // --- SUB-COMPONENT: The Scatter Plot View ---
  const renderScatterView = () => {
    const currentBranchData = data[viewingBranch];
    const scatterOutput = currentBranchData?.outputs?.o1;
    // Use normalized metrics for the cards too!
    const metrics = getNormalizedMetrics(viewingBranch); 

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => setViewingBranch(null)}
            style={{ 
              background: '#f0f0f0', border: '1px solid #ddd', padding: '5px 12px', 
              borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
             ← Back
          </button>
          <h2 style={{ margin: 0 }}>Analysis: {viewingBranch.replace('_', ' ')}</h2>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            {Object.entries(metrics).length > 0 ? (
              Object.entries(metrics).map(([key, val]) => (
                <div key={key} style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '5px' }}>{key}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                    {typeof val === 'number' ? val.toFixed(4) : val}
                  </div>
                </div>
              ))
            ) : (
               <div style={{color: '#999'}}>No metrics available for this branch.</div>
            )}
          </div>

          {scatterOutput ? (
            <div style={{ height: '450px', background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
              <div style={{ marginBottom: 10, fontWeight: 'bold', color: '#555' }}>Cluster Visualization</div>
              <ResponsiveContainer width="100%" height="90%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="PC1" />
                  <YAxis type="number" dataKey="y" name="PC2" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Clusters" data={scatterOutput.data} fill="#8884d8">
                    {scatterOutput.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.cluster % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', background: '#fff', borderRadius: '8px', color: '#999', border: '1px dashed #ccc' }}>
              No scatter plot data available (o1 output missing).
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- SUB-COMPONENT: The Summary Table View ---
  const renderTableView = () => {
    return (
      <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
         <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Comparison Dashboard</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✕</button>
         </div>

         <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                <tr>
                  <th style={{ padding: '15px', fontWeight: '600', color: '#555' }}>Branch / Model</th>
                  {allMetricHeaders.map(header => (
                    <th key={header} style={{ padding: '15px', fontWeight: '600', color: '#555' }}>
                      {header}
                    </th>
                  ))}
                  <th style={{ padding: '15px', fontWeight: '600', color: '#555', textAlign: 'center' }}>Visualization</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const metrics = getNormalizedMetrics(branch); // <--- USE NORMALIZED HERE
                  const hasScatter = data[branch]?.outputs?.o1;
                  const isFailed = data[branch]?.status === 'failed' || data[branch]?.error;

                  return (
                    <tr key={branch} style={{ borderBottom: '1px solid #eee', background: isFailed ? '#fff5f5' : '#fff' }}>
                      <td style={{ padding: '15px', fontWeight: '500', color: branch === 'main' ? '#007bff' : '#333' }}>
                        {branch.replace('_', ' ')} {branch === 'main' && <span style={{fontSize: '10px', background:'#eef', padding:'2px 6px', borderRadius:'4px', marginLeft:'5px'}}>PRIMARY</span>}
                        {isFailed && <span style={{marginLeft: 10}}>⚠️</span>}
                      </td>

                      {allMetricHeaders.map(header => (
                        <td key={header} style={{ padding: '15px', color: '#666', fontFamily: 'monospace' }}>
                           {metrics[header] !== undefined 
                              ? (typeof metrics[header] === 'number' ? metrics[header].toFixed(4) : metrics[header])
                              : <span style={{color:'#eee'}}>-</span>
                           }
                        </td>
                      ))}

                      <td style={{ padding: '15px', textAlign: 'center' }}>
                         {hasScatter ? (
                            <button 
                              onClick={() => setViewingBranch(branch)}
                              style={{ 
                                background: '#007bff', color: '#fff', border: 'none', 
                                padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' 
                              }}
                            >
                              View Scatter Plot
                            </button>
                         ) : (
                           <span style={{ fontSize: '12px', color: '#ccc' }}>No Graph</span>
                         )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
         </div>
      </div>
    );
  };

  return (
    <div style={{ 
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', 
      background: '#f8f9fa', borderTop: '3px solid #007bff', 
      zIndex: 20, boxShadow: '0 -4px 15px rgba(0,0,0,0.15)'
    }}>
      {viewingBranch ? renderScatterView() : renderTableView()}
    </div>
  );
};