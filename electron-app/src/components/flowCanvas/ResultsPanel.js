import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
  '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'
];

const METRIC_MAPPING = {
  Algorithm: ['algo', 'algorithm', 'model', 'model_name'],
  'Clusters (K)': ['n_clusters', 'best_k', 'k', 'num_clusters', 'clusters'],
  'Silhouette Score': ['silhouette', 'silhouette_score', 'sil_score'],
  'Calinski-Harabasz': ['calinski', 'calinski_harabasz_score', 'ch_score'],
  'Davies-Bouldin': ['davies', 'davies_bouldin_score', 'db_score'],
  Accuracy: ['accuracy', 'acc'],
  'F1 Score': ['f1', 'f1_score']
};

export const ResultsPanel = ({ data, onClose }) => {
  const [viewingBranch, setViewingBranch] = useState(null);

  useEffect(() => {
    if (!data) return;
    console.log('🚀 [ResultsPanel]', data);
  }, [data]);

  const branches = useMemo(() => {
    return Object.keys(data || {}).sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
  }, [data]);

  const getNormalizedMetrics = useCallback((branchKey) => {
    const branch = data?.[branchKey];
    if (!branch?.trainingResults?.length) return {};

    const rawMetrics = branch.trainingResults[0].metrics || {};
    const normalized = {};

    Object.entries(METRIC_MAPPING).forEach(([label, keys]) => {
      for (const k of keys) {
        if (rawMetrics[k] !== undefined) {
          normalized[label] = rawMetrics[k];
          break;
        }
      }
    });

    const mappedKeys = Object.values(METRIC_MAPPING).flat();
    Object.keys(rawMetrics).forEach(k => {
      if (!mappedKeys.includes(k)) {
        normalized[
          k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')
        ] = rawMetrics[k];
      }
    });

    return normalized;
  }, [data]);

  const allMetricHeaders = useMemo(() => {
    const headers = new Set();
    branches.forEach(b => {
      Object.keys(getNormalizedMetrics(b)).forEach(h => headers.add(h));
    });

    const priority = [
      'Algorithm',
      'Clusters (K)',
      'Silhouette Score',
      'Calinski-Harabasz',
      'Davies-Bouldin'
    ];

    return Array.from(headers).sort((a, b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [branches, getNormalizedMetrics]);

  if (!data || !branches.length) return null;

  /* ---------------- SCATTER VIEW ---------------- */

  const renderScatterView = () => {
    const branchData = data[viewingBranch];
    const scatterOutput = branchData?.outputs?.o1;
    const metrics = getNormalizedMetrics(viewingBranch);

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee', display: 'flex', gap: 12 }}>
          <button
            onClick={() => setViewingBranch(null)}
            style={{
              background: '#f0f0f0',
              border: '1px solid #ddd',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>
            Analysis: {viewingBranch.replace('_', ' ')}
          </h2>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 15,
              marginBottom: 20
            }}
          >
            {Object.entries(metrics).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: '#fff',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #eee',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {k}
                </div>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {typeof v === 'number' ? v.toFixed(4) : v}
                </div>
              </div>
            ))}
          </div>

          {Array.isArray(scatterOutput?.data) ? (
            <div
              style={{
                height: 450,
                background: '#fff',
                padding: 20,
                borderRadius: 12,
                border: '1px solid #eee'
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" />
                  <YAxis type="number" dataKey="y" />
                  <Tooltip />
                  <Scatter data={scatterOutput.data}>
                    {scatterOutput.data.map((p, i) => (
                      <Cell key={i} fill={COLORS[p.cluster % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999' }}>
              No visualization data available.
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ---------------- TABLE VIEW (FIXED UI) ---------------- */

  const renderTableView = () => (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}
      >
        <h2 style={{ margin: 0 }}>Comparison Dashboard</h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#999'
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #eee',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
            <tr>
              <th style={{ padding: 14, textAlign: 'left' }}>Branch</th>
              {allMetricHeaders.map(h => (
                <th key={h} style={{ padding: 14, textAlign: 'left' }}>{h}</th>
              ))}
              <th style={{ padding: 14, textAlign: 'center' }}>Visualization</th>
            </tr>
          </thead>

          <tbody>
            {branches.map(branch => {
              const metrics = getNormalizedMetrics(branch);
              const hasGraph = data[branch]?.outputs?.o1?.data;

              return (
                <tr key={branch} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 14, fontWeight: 500 }}>
                    {branch}
                  </td>

                  {allMetricHeaders.map(h => (
                    <td
                      key={h}
                      style={{ padding: 14, fontFamily: 'monospace', color: '#555' }}
                    >
                      {metrics[h] !== undefined
                        ? typeof metrics[h] === 'number'
                          ? metrics[h].toFixed(4)
                          : metrics[h]
                        : '—'}
                    </td>
                  ))}

                  <td style={{ padding: 14, textAlign: 'center' }}>
                    {hasGraph ? (
                      <button
                        onClick={() => setViewingBranch(branch)}
                        style={{
                          background: '#007bff',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        View Scatter
                      </button>
                    ) : (
                      <span style={{ color: '#ccc', fontSize: 12 }}>No Graph</span>
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

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#f8f9fa',
        zIndex: 20
      }}
    >
      {viewingBranch ? renderScatterView() : renderTableView()}
    </div>
  );
};
