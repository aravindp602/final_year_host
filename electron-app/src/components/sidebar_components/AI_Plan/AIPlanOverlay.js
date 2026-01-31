import React from 'react';

import { styles } from './styles';
import AssessmentView from './AssessmentView';
import ConfigurationView from './ConfigurationView';

import ErrorPopup from '../../ErrorPopup'; 
import LoadingOverlay from '../../LoadingOverlay';

import { useAIPlanLogic } from './useAIPlanLogic';

const AIPlanOverlay = (props) => {
  const {
    activeTab, setActiveTab,
    viewStep, setViewStep,
    localPlan,
    summaryText,
    editorText, setEditorText,
    isExecuting,
    isRegenerating,
    errorMessage, setErrorMessage,
    handleRemoveStep,
    handleAddStep,
    handleRegeneration,
    handleExecute
  } = useAIPlanLogic(props);

  return (
    <div style={styles.overlay}>
      
      {/* LOADING OVERLAY (Shows when executing) */}
      {isExecuting && <LoadingOverlay message="Executing AI Protocol..." />}

      {/* ERROR POPUP */}
      {errorMessage && (
        <ErrorPopup 
          message={errorMessage} 
          onClose={() => setErrorMessage(null)} 
        />
      )}

      <div style={styles.modal}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerTitle}>🧬 Clinical AI Protocol Engine</div>
            <div style={styles.headerSub}>
              {viewStep === 'assess' ? 'Phase 1 — Clinical Analysis & AI Strategy' : 'Phase 2 — Protocol Configuration & Execution'}
            </div>
          </div>

          <div style={{display:'flex', gap:'14px'}}>
            {viewStep === 'assess' && (
              <>
                <button onClick={props.onClose} style={styles.btnGhost}>Cancel</button>
                <button onClick={() => setViewStep('configure')} style={styles.btnPrimary}>
                  Review Configuration →
                </button>
              </>
            )}

            {viewStep === 'configure' && (
              <>
                <button onClick={() => setViewStep('assess')} style={styles.btnGhost}>Back</button>
                <button onClick={handleExecute} disabled={isExecuting} style={styles.btnPrimary}>
                  {isExecuting ? 'Processing...' : '🚀 Execute AI Plan'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* SUB-COMPONENTS */}
        {viewStep === 'assess' && (
          <AssessmentView 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            summaryText={summaryText}
            editorText={editorText}
            setEditorText={setEditorText}
            handleRegeneration={handleRegeneration}
            isRegenerating={isRegenerating}
          />
        )}

        {viewStep === 'configure' && (
          <ConfigurationView 
            localPlan={localPlan}
            handleRemoveStep={handleRemoveStep}
            handleAddStep={handleAddStep}
          />
        )}

      </div>
    </div>
  );
};

export default AIPlanOverlay;