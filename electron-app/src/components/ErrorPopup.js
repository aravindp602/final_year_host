// src/components/ErrorPopup.js
import React from 'react';
import ReactDOM from 'react-dom';

const ErrorPopup = ({ message, onClose }) => {
  return ReactDOM.createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(3px)'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          padding: '20px 30px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          minWidth: '300px',
          maxWidth: '500px',
        }}
      >
        <span style={{ flex: 1, marginRight: '15px', fontSize: '16px' }}>
          {message}
        </span>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#721c24',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: '0 5px',
            lineHeight: 1,
            outline: 'none',
          }}
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ErrorPopup;
