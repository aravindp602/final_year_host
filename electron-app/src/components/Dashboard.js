import React, { useState } from 'react'; 
import Sidebar from './Sidebar';
import FlowCanvas from './flowCanvas/FlowCanvas';
import LoadingOverlay from './LoadingOverlay';

const Dashboard = () => {
  const [file, setFile] = useState(null);
  const [domain, setDomain] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [medicalPlan, setMedicalPlan] = useState(null);
  const [medicalExplanation, setMedicalExplanation] = useState(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {isLoading && <LoadingOverlay message="Processing..." />}

      <header style={{ backgroundColor: '#007bff', color: 'white', padding: '12px 20px', fontSize: '20px', fontWeight: 'bold', flexShrink: 0 }}>
         AutoML Tool
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <FlowCanvas 
            file={file} 
            domain={domain} 
            style={{ flex: 1, minHeight: 0 }}
            setGlobalLoading={setIsLoading}
          />
          <footer style={{ backgroundColor: '#f1f1f1', padding: '10px 20px', textAlign: 'center', borderTop: '1px solid #ccc', flexShrink: 0 }}>
            Drag and Drop components
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;