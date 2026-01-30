import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function ViewPaste() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [paste, setPaste] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const maxRetries = 3;
  
  // Fetch paste metadata (doesn't decrement views)
  const fetchPaste = useCallback(async () => {
    if (!id) {
      setError('Invalid paste ID');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/pastes/${id}/metadata`);
      
      if (!response.ok) {
        if (response.status === 404) {
          const data = await response.json();
          throw new Error(data.error || 'Paste not found, expired, or view limit exceeded');
        }
        throw new Error(`HTTP ${response.status}: Failed to fetch paste`);
      }
      
      const data = await response.json();
      setPaste(data);
      setRetryCount(0);
      
    } catch (err) {
      console.error('Error fetching paste:', err);
      
      // Retry logic for network errors
      if (retryCount < maxRetries && err.message.includes('Failed to fetch')) {
        console.log(`Retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchPaste();
        }, 1000 * (retryCount + 1));
        return;
      }
      
      setError(err.message || 'Failed to load paste');
    } finally {
      setLoading(false);
    }
  }, [id, retryCount, maxRetries]);
  
  useEffect(() => {
    fetchPaste();
  }, [id]); // Only depend on id, not fetchPaste to avoid infinite loop
  
  // Copy content to clipboard
  const copyContent = async () => {
    if (!paste?.content) return;
    
    // Decode HTML entities before copying
    const textarea = document.createElement('textarea');
    textarea.innerHTML = paste.content;
    const decodedContent = textarea.value;
    
    try {
      await navigator.clipboard.writeText(decodedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback
      const input = document.createElement('textarea');
      input.value = decodedContent;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Copy URL to clipboard
  const copyUrl = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };
  
  // Format date/time
  const formatDateTime = (isoString) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      return isoString;
    }
  };
  
  // Calculate time remaining
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    
    try {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      
      if (diff <= 0) return 'Expired';
      
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
      if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } catch (err) {
      return null;
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading paste...</p>
            {retryCount > 0 && (
              <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
                Retrying... ({retryCount}/{maxRetries})
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="error-container">
            <h1 className="error-title">😔</h1>
            <p style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Paste Not Available</p>
            <p>{error}</p>
            
            {error.includes('not found') && (
              <div className="alert alert-info" style={{ marginTop: 24, textAlign: 'left' }}>
                <span>ℹ️</span>
                <div className="alert-content">
                  <strong>Possible reasons:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>The paste doesn't exist</li>
                    <li>The paste has expired</li>
                    <li>The view limit has been reached</li>
                    <li>The paste was deleted</li>
                  </ul>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => navigate('/')} className="btn btn-primary">
                Create New Paste
              </button>
              {retryCount < maxRetries && (
                <button onClick={fetchPaste} className="btn btn-secondary">
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Success state
  return (
    <div className="container">
      <div className="card">
        <div className="paste-header">
          <h1 className="paste-title">📋 Paste</h1>
          <div className="paste-meta">
            {paste.remaining_views !== null && (
              <div className="meta-badge views">
                👁️ {paste.remaining_views} view{paste.remaining_views !== 1 ? 's' : ''} remaining
              </div>
            )}
            {paste.expires_at && (
              <div className="meta-badge expiry">
                ⏰ Expires in {getTimeRemaining(paste.expires_at)}
              </div>
            )}
          </div>
        </div>
        
        {/* Warning if views or expiry is critical */}
        {(paste.remaining_views !== null && paste.remaining_views <= 3) && (
          <div className="alert alert-warning">
            <span>⚠️</span>
            <div className="alert-content">
              <strong>Low view count</strong>
              <p>This paste only has {paste.remaining_views} view{paste.remaining_views !== 1 ? 's' : ''} remaining before it becomes unavailable.</p>
            </div>
          </div>
        )}
        
        <div className="paste-content">
          <pre dangerouslySetInnerHTML={{ __html: paste.content }} />
        </div>
        
        <div className="paste-actions">
          <button onClick={copyContent} className={`btn btn-primary ${copied ? 'copied' : ''}`}>
            {copied ? '✓ Copied!' : '📋 Copy Content'}
          </button>
          <button onClick={copyUrl} className="btn btn-secondary">
            🔗 Copy Link
          </button>
          <button onClick={() => navigate('/')} className="btn btn-secondary">
            ➕ Create New Paste
          </button>
        </div>
        
        {/* Metadata section */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid #e0e0e0' }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: '#666' }}>Paste Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div>
              <strong style={{ fontSize: 13, color: '#999', display: 'block', marginBottom: 4 }}>
                Created
              </strong>
              <span style={{ fontSize: 14 }}>
                {paste.created_at ? formatDateTime(paste.created_at) : 'Unknown'}
              </span>
            </div>
            <div>
              <strong style={{ fontSize: 13, color: '#999', display: 'block', marginBottom: 4 }}>
                Expires
              </strong>
              <span style={{ fontSize: 14 }}>
                {paste.expires_at ? formatDateTime(paste.expires_at) : 'Never'}
              </span>
            </div>
            <div>
              <strong style={{ fontSize: 13, color: '#999', display: 'block', marginBottom: 4 }}>
                View Limit
              </strong>
              <span style={{ fontSize: 14 }}>
                {paste.remaining_views !== null ? `${paste.remaining_views} remaining` : 'Unlimited'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="alert alert-info" style={{ marginTop: 24 }}>
          <span>ℹ️</span>
          <div className="alert-content">
            <strong>Note:</strong> Viewing this page doesn't count toward the view limit. 
            Only API fetches (GET /api/pastes/:id) decrement the view count.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewPaste;
