// ConfigurationView.js
import React from 'react';
import { styles } from './styles';
import { AVAILABLE_MODULES } from './modules';

const ConfigurationView = ({ 
  localPlan, 
  handleRemoveStep, 
  handleAddStep 
}) => {
  return (
    <div style={styles.content}>
      <div style={styles.cardContainer}>
        {Object.entries(localPlan).map(([col, details]) => (
          <div key={col} style={styles.card}>
            <div style={styles.colSection}>
              <div style={styles.colName}>{col}</div>
              <div style={styles.colSub}>{details.steps.length} Actions</div>
            </div>

            <div style={styles.pipelineSection}>
              <div style={styles.pipelineVisual}>
                {details.steps.map((step, i) => (
                  <React.Fragment key={i}>
                    <div style={styles.stepBadge(step.color)}>
                      {step.label}
                      <span onClick={() => handleRemoveStep(col, i)} style={{ cursor: 'pointer' }}>✕</span>
                    </div>
                    <span style={styles.arrow}>➜</span>
                  </React.Fragment>
                ))}

                <select
                  onChange={(e) => { if (e.target.value) handleAddStep(col, e.target.value); e.target.value = ""; }}
                  style={styles.addBtn}
                >
                  <option value="">＋ Add Step</option>
                  {AVAILABLE_MODULES.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div style={styles.reasonBox}>
                <strong>AI Logic:</strong> {details.reason}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfigurationView;