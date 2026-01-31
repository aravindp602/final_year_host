import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from "../../../config"; 
import { AVAILABLE_MODULES } from './modules';

export const useAIPlanLogic = ({ file, initialPlan, explanation, onClose, onExecutionComplete }) => {
  const [activeTab, setActiveTab] = useState('report'); 
  const [viewStep, setViewStep] = useState('assess');
  const [localPlan, setLocalPlan] = useState({});
  const [summaryText, setSummaryText] = useState("");
  const [editorText, setEditorText] = useState(""); 
  
  // Execution & Loading States
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Error Management
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (explanation) {
      setSummaryText(typeof explanation === 'object' ? explanation.summary : explanation);
      setEditorText(typeof explanation === 'object' ? explanation.strategy : explanation);
    }
  }, [explanation]);

  useEffect(() => {
    if (initialPlan) {
      const normalized = {};
      Object.keys(initialPlan).forEach(col => {
        const item = initialPlan[col];
        let steps = Array.isArray(item.steps) ? item.steps : [];
        steps = steps.map(s => {
          const mod = AVAILABLE_MODULES.find(m => m.name === s.action || m.id === s.moduleId);
          return { ...s, label: mod?.label || s.action, color: mod?.color || '#64748b' };
        });
        normalized[col] = { reason: item.reason || "", steps };
      });
      setLocalPlan(normalized);
    }
  }, [initialPlan]);

  const handleRemoveStep = (col, idx) => {
    setLocalPlan(prev => ({
      ...prev,
      [col]: { ...prev[col], steps: prev[col].steps.filter((_, i) => i !== idx) }
    }));
  };

  const handleAddStep = (col, moduleId) => {
    const mod = AVAILABLE_MODULES.find(m => m.id === moduleId);
    if (!mod) return;
    setLocalPlan(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        steps: [...prev[col].steps, {
          action: mod.name,
          moduleId: mod.id,
          label: mod.label,
          color: mod.color,
          params: "auto"
        }]
      }
    }));
  };

  const handleRegeneration = async () => {
    if (!editorText.trim()) return;
    setIsRegenerating(true);
    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("report", editorText);
    try {
      const res = await axios.post(`${API_BASE_URL}/regenerate-plan`, formData);
      if (res.data.plan) {
        const normalized = {};
        Object.entries(res.data.plan).forEach(([col, item]) => {
          const steps = (item.steps || []).map(s => {
            const mod = AVAILABLE_MODULES.find(m => m.name === s.action || m.id === s.moduleId);
            return { ...s, label: mod?.label || s.action, color: mod?.color || '#64748b' };
          });
          normalized[col] = { reason: item.reason, steps };
        });
        setLocalPlan(normalized);
        setActiveTab('blueprint');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Sync Failed: Unable to regenerate plan. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("plan", JSON.stringify(localPlan));
    try {
      const res = await axios.post(`${API_BASE_URL}/execute-approved-plan`, formData);
      console.log("Execution result:", res.data);
      onExecutionComplete?.(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage("Execution Failed: The system encountered an error running the protocol.");
    } finally {
      setIsExecuting(false);
    }
  };

  return {
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
  };
};