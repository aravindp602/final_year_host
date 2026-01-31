import React, { useRef, useState } from "react";

const FileUploader = ({ onFileSelect, onDatasetUpload }) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    setSelectedFile(file);
    onFileSelect(file);
    if (onDatasetUpload) onDatasetUpload(file);
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation(); // Prevent triggering the file input
    setSelectedFile(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag and Drop Handlers
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Dataset</h3>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            ...styles.dropZone,
            borderColor: isDragging ? "#2563eb" : "#e2e8f0",
            backgroundColor: isDragging ? "#f0f7ff" : "#ffffff",
          }}
        >
          <div style={styles.uploadIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={styles.textContainer}>
            <span style={styles.mainText}>Click to upload</span>
            <span style={styles.subText}>or drag and drop CSV</span>
          </div>
        </div>
      ) : (
        <div style={styles.fileCard}>
          <div style={styles.fileIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div style={styles.fileInfo}>
            <span style={styles.fileName}>{selectedFile.name}</span>
            <span style={styles.fileSize}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
          </div>
          <button onClick={handleRemoveFile} style={styles.removeBtn} title="Remove file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
    heading: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#475569", // Slate 600
    margin: "0 0 4px 0",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    marginTop: "10px",
  },
  
  dropZone: {
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    borderRadius: "10px",
    border: "2px dashed #e2e8f0",
    transition: "all 0.2s ease-in-out",
    textAlign: "center",
  },
  uploadIcon: {
    color: "#94a3b8",
    marginBottom: "10px",
  },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  mainText: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#2563eb", // Primary Blue
  },
  subText: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  fileCard: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    gap: "10px",
  },
  fileIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    backgroundColor: "#eff6ff",
    borderRadius: "6px",
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0, // Critical for text ellipsis
  },
  fileName: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fileSize: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  removeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "all 0.2s",
    ":hover": {
        color: "#ef4444",
        backgroundColor: "#fee2e2"
    }
  },
};

export default FileUploader;