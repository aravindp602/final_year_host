import { useCallback } from 'react';
import axios from 'axios';
import { extractChains } from '../branchExtractor';

export const usePipelineRunner = ({ localFile, nodes, edges, setResults, setError, setLoading, onValidate }) => {
  
  const handleRunConfig = useCallback(async () => {
    if (!localFile) { 
      setError("Please upload a dataset file first.");
      return;
    }

    if (onValidate) {
      const validationError = onValidate();
      if (validationError) return setError(validationError); 
    }

    setError(null); 
    
    const allChains = extractChains(nodes, edges);
    const { main, ...customBranches } = allChains;

    if (Object.keys(customBranches).length === 0) {
        setError("No custom branches found! Please create a new branch before running configuration.");
        return;
    }

    const formData = new FormData();
    formData.append("dataset", localFile); 
    formData.append("chains", JSON.stringify(customBranches));

    try {
      setLoading(true); 
      
      const res = await axios.post("http://localhost:5000/run-config", formData);

      if (res.status === 200) {
        const { outputs, errors } = res.data;
        
        // 1. Handle Successes
        if (outputs && Object.keys(outputs).length > 0) {
          setResults((prevResults) => ({
            ...prevResults,
            ...outputs
          }));
        }

        // 2. Handle Errors (Display Message)
        if (errors && Object.keys(errors).length > 0) {
            const errorList = Object.entries(errors)
                .map(([branch, msg]) => `• ${branch.replace('_', ' ')}: ${msg}`)
                .join('\n');
            
            // Set error but KEEP results if some succeeded
            setError(`⚠️ Some branches failed to process:\n${errorList}`);
        } else if (!outputs || Object.keys(outputs).length === 0) {
             setError("Pipeline finished, but no valid results were returned.");
        }
      }
    } catch (err) {
      console.error("❌ [RunConfig] Error sending config:", err);
      setError("Critical Error: Unable to process configuration.");
    } finally {
      setLoading(false); 
    }
  }, [localFile, nodes, edges, setResults, setError, setLoading, onValidate]);

  return { handleRunConfig };
};