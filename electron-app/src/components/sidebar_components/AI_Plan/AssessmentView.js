// AssessmentView.js
import React from 'react';
import { styles } from './styles';
import LoadingOverlay from '../../LoadingOverlay'; // Adjusted path to match your project structure

const AssessmentView = ({ 
  activeTab, 
  setActiveTab, 
  summaryText, 
  editorText, 
  setEditorText, 
  handleRegeneration, 
  isRegenerating 
}) => {
  return (
    <>
      {/* Loading Overlay for Sync Action */}
      {isRegenerating && <LoadingOverlay message="Regenerating AI Plan..." />}

      <div style={styles.tabBar}>
        <div style={styles.tab(activeTab === 'report')} onClick={() => setActiveTab('report')}>
          Clinical Report
        </div>
        <div style={styles.tab(activeTab === 'blueprint')} onClick={() => setActiveTab('blueprint')}>
          AI Strategy Blueprint
        </div>
      </div>

      <div style={styles.content}>
        {activeTab === 'report' && (
          <div style={styles.paper}>
            <h2 style={{ marginTop: 10, color: '#2563eb' }}>Clinical Intelligence Report</h2>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: '24px' }}>{summaryText}</div>
          </div>
        )}

        {activeTab === 'blueprint' && (
          <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', height: '100%' }}>
            <div style={{ height: '100%', background: '#fff', borderRadius: '18px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <strong>AI Strategy Editor</strong>
                <button onClick={handleRegeneration} style={styles.btnPrimary}>
                  {isRegenerating ? 'Regenerating...' : 'Regenerate AI Plan'}
                </button>
              </div>
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                style={{
                  flex: 1, border: 'none', padding: '30px', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px', outline: 'none', resize: 'none', background: '#f8fafc'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AssessmentView;