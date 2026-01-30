import React, { useState } from 'react';
import Sidebar from './Sidebar';
import FlowCanvas from './flowCanvas/FlowCanvas';
import LoadingOverlay from './LoadingOverlay';
import InstructionOverlay from './instruction_manual/InstructionOverlay';

const Dashboard = () => {
  // --- State Management ---
  const [file, setFile] = useState(null);
  const [domain, setDomain] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [medicalPlan, setMedicalPlan] = useState(null);
  const [medicalExplanation, setMedicalExplanation] = useState(null);
  
  // UI State
  const [showInstructions, setShowInstructions] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  // --- Handlers ---
  const handleFileChange = (newFile) => {
    setFile(newFile);
    setDomain(null);
    setMedicalPlan(null);
    setMedicalExplanation(null);
  };

  const handleDomainDetected = (detectedDomain) => {
    setDomain(detectedDomain);
  };

  const handlePlanGenerated = (plan, explanation) => {
    setMedicalPlan(plan);
    setMedicalExplanation(explanation);
  };

  return (
    <div style={styles.dashboardContainer}>
      {isLoading && <LoadingOverlay message="Processing..." />}

      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </div>
          <span style={styles.logoText}>AutoML <span style={{ fontWeight: 300 }}>Tool</span></span>
        </div>

        {/* TOP RIGHT NAVIGATION */}
        <div style={styles.navActions}>
          <div style={styles.segmentedControl}>
            <button
              style={{
                ...styles.navButton,
                backgroundColor: hoveredBtn === 'feedback' ? 'rgba(255,255,255,0.2)' : 'transparent',
              }}
              onMouseEnter={() => setHoveredBtn('feedback')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => window.open('https://your-feedback-link.com', '_blank')}
            >
              Give Feedback
            </button>
            <div style={styles.verticalDivider} />
            <button
              style={{
                ...styles.navButton,
                backgroundColor: hoveredBtn === 'guide' ? 'rgba(255,255,255,0.2)' : 'transparent',
              }}
              onMouseEnter={() => setHoveredBtn('guide')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => setShowInstructions(true)}
            >
              User Guide
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div style={styles.mainLayout}>
        <Sidebar
          file={file}
          onFileChange={handleFileChange}
          onDomainDetected={handleDomainDetected}
          domain={domain}
          setGlobalLoading={setIsLoading}
          medicalPlan={medicalPlan}
          medicalExplanation={medicalExplanation}
          onPlanGenerated={handlePlanGenerated}
          onPlanUpdate={setMedicalPlan}
        />

        <div style={styles.canvasWrapper}>
          <FlowCanvas
            file={file}
            domain={domain}
            style={{ flex: 1, minHeight: 0 }}
            setGlobalLoading={setIsLoading}
          />
          <footer style={styles.footer}>
            Drag and Drop components from the sidebar to the canvas to build your ML workflow.
          </footer>
        </div>
      </div>

      {showInstructions && (
        <InstructionOverlay onClose={() => setShowInstructions(false)} />
      )}
    </div>
  );
};

/* ===================== STYLES ===================== */

const styles = {
  dashboardContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: '#f8fafc',
  },

  header: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', // Deep modern Navy
    color: 'white',
    padding: '0 24px',
    height: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    zIndex: 100,
    flexShrink: 0,
  },

  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  logoIcon: {
    background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
    width: '32px',
    height: '32px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '8px',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },

  logoText: {
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.025em',
    color: '#f8fafc',
  },

  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  segmentedControl: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle glass effect
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '2px',
  },

  navButton: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },

  verticalDivider: {
    width: '2px',
    height: '17px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    margin: '0 2px',
    borderRadius: '8px',
  },

  mainLayout: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },

  canvasWrapper: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },

  footer: {
    backgroundColor: '#fff',
    padding: '10px 20px',
    textAlign: 'center',
    borderTop: '1px solid #e0e0e0',
    color: '#6a6a6a',
    fontSize: '14px',
    fontWeight: '500',
    flexShrink: 0,
  },
};

export default Dashboard;