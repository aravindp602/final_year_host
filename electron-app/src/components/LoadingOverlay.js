import React from 'react';

const LoadingOverlay = ({ message = "Processing..." }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black
      zIndex: 9999, // Very high z-index to sit on top of everything
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      backdropFilter: 'blur(3px)' // Adds a nice blur effect
    }}>
      {/* CSS Spinner */}
      <div className="spinner"></div>
      
      <h3 style={{ marginTop: '20px', fontWeight: '500' }}>{message}</h3>

      <style>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;