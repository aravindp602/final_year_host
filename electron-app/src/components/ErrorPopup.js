// src/components/ErrorPopup.js
import React from 'react';

const ErrorPopup = ({ message, onClose }) => {
  return (
    // 1. The outer overlay wrapper (styles copied and adapted from LoadingOverlay)
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black overlay
        zIndex: 10000, // High z-index to sit on top of everything
        display: 'flex',
        justifyContent: 'center', // Centers horizontally
        alignItems: 'center', // Centers vertically
        backdropFilter: 'blur(3px)' // Adds the blur effect to the background
      }}
      onClick={onClose} // Clicking the background overlay closes the popup
    >
      {/* 2. The actual error box container */}
      <div 
        // Stop propagation so clicking the box itself doesn't trigger the overlay's onClose
        onClick={(e) => e.stopPropagation()} 
        style={{
          // Position properties removed (handled by outer wrapper now)
          // position: 'fixed', 
          // top: '100px',
          // left: '50%',
          // transform: 'translateX(-50%)',
          
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          padding: '20px 30px', // Increased padding slightly for visual balance in center
          borderRadius: '8px',
          // zIndex: 1000, // Removed unused zIndex
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', // Stronger shadow for better pop against dark bg
          display: 'flex',
          alignItems: 'center',
          minWidth: '300px',
          maxWidth: '500px',
        }}
      >
        <span style={{ flex: 1, marginRight: '15px', fontSize: '16px' }}>{message}</span>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#721c24',
            fontSize: '24px', // Slightly larger close 'X'
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
    </div>
  );
};

export default ErrorPopup;