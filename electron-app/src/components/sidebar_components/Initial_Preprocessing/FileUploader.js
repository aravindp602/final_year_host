import React from "react";

const FileUploader = ({ onFileSelect, onDatasetUpload }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    onFileSelect(file);
    onDatasetUpload(file);  // ← trigger dataset node creation
  };

  return (
    <div>
      <h3>Upload Dataset</h3>
      <input
        type="file"
        accept=".csv, .xlsx, .xls"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default FileUploader;
