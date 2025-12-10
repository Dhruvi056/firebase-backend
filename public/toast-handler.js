// Universal toast handler - Add this script to any page to show toast messages
// This script checks localStorage for toast messages and displays them

(function() {
  'use strict';
  
  const TOAST_ID = '__firebase_toast_handler__';
  
  function createToastContainer() {
    let container = document.getElementById(TOAST_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_ID;
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '99999';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }
    return container;
  }
  
  function showToast(message, success) {
    const container = createToastContainer();
    
    const toast = document.createElement('div');
    toast.style.background = success ? '#e8f5e9' : '#fee2e2';
    toast.style.color = success ? '#166534' : '#991b1b';
    toast.style.padding = '16px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    toast.style.maxWidth = '320px';
    toast.style.fontSize = '14px';
    toast.style.lineHeight = '1.5';
    toast.style.borderLeft = `4px solid ${success ? '#4caf50' : '#f44336'}`;
    toast.style.marginBottom = '10px';
    toast.style.fontFamily = 'Arial, sans-serif';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.style.pointerEvents = 'auto';
    
    toast.innerHTML = `
      <span style="font-size: 20px; margin-right: 8px; display: inline-block;">${success ? '✓' : '✗'}</span>
      <span>${message}</span>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    if (!document.getElementById('__firebase_toast_styles__')) {
      style.id = '__firebase_toast_styles__';
      document.head.appendChild(style);
    }
    
    container.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }
  
  function checkForToast() {
    try {
      const stored = localStorage.getItem('__firebase_form_toast__');
      if (stored) {
        const data = JSON.parse(stored);
        // Only show if message is recent (within last 5 seconds)
        if (Date.now() - data.timestamp < 5000) {
          showToast(data.message, data.success);
          // Clear the stored message
          localStorage.removeItem('__firebase_form_toast__');
        }
      }
    } catch(e) {
      // Ignore errors
    }
  }
  
  // Check immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForToast);
  } else {
    checkForToast();
  }
  
  // Also check on page focus (in case user navigated back)
  window.addEventListener('focus', checkForToast);
  
  // Check periodically (fallback)
  setInterval(checkForToast, 1000);
})();

