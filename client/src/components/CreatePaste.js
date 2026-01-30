import React, { useState, useCallback, useRef } from 'react';

function CreatePaste() {
  const [content, setContent] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const textareaRef = useRef(null);
  
  // Character count with warnings
  const charCount = content.length;
  const maxChars = 10 * 1024 * 1024; // 10MB
  const charCountClass = charCount > maxChars * 0.9 ? 'error' : charCount > maxChars * 0.7 ? 'warning' : '';
  
  // Validate inputs
  const validateInputs = useCallback(() => {
    if (!content || content.trim() === '') {
      return { valid: false, error: 'Content cannot be empty' };
    }
    
    if (content.length > maxChars) {
      return { valid: false, error: 'Content exceeds maximum size of 10MB' };
    }
    
    if (ttlSeconds !== '') {
      const ttl = parseInt(ttlSeconds, 10);
      if (isNaN(ttl) || ttl < 1) {
        return { valid: false, error: 'TTL must be a positive integer' };
      }
      if (ttl > 365 * 24 * 60 * 60) {
        return { valid: false, error: 'TTL cannot exceed 1 year' };
      }
    }
    
    if (maxViews !== '') {
      const views = parseInt(maxViews, 10);
      if (isNaN(views) || views < 1) {
        return { valid: false, error: 'Max views must be a positive integer' };
      }
      if (views > 1000000) {
        return { valid: false, error: 'Max views cannot exceed 1,000,000' };
      }
    }
    
    return { valid: true };
  }, [content, ttlSeconds, maxViews, maxChars]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous results
    setResult(null);
    setError(null);
    setCopied(false);
    
    // Validate
    const validation = validateInputs();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setLoading(true);
    
    try {
      const payload = { content };
      
      if (ttlSeconds !== '') {
        payload.ttl_seconds = parseInt(ttlSeconds, 10);
      }
      
      if (maxViews !== '') {
        payload.max_views = parseInt(maxViews, 10);
      }
      
      const response = await fetch('/api/pastes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to create paste`);
      }
      
      setResult(data);
      
      // Clear form
      setContent('');
      setTtlSeconds('');
      setMaxViews('');
      
      // Scroll to result
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      
    } catch (err) {
      console.error('Error creating paste:', err);
      setError(err.message || 'Failed to create paste. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Copy URL to clipboard
  const copyToClipboard = async () => {
    if (!result?.url) return;
    
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = result.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1>📋 Pastebin Lite</h1>
          <p>Share text snippets with optional expiration and view limits</p>
        </div>
        
        {/* Success Message */}
        {result && (
          <div className="alert alert-success">
            <span>✓</span>
            <div className="alert-content">
              <strong>Paste created successfully!</strong>
              <div className="url-box">
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.url}
                </a>
                <button
                  onClick={copyToClipboard}
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  aria-label="Copy URL to clipboard"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="alert alert-error">
            <span>✗</span>
            <div className="alert-content">
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {/* Create Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="form-group">
            <label htmlFor="content">
              Content <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your text here... (Ctrl+Enter to submit)"
              required
              disabled={loading}
              aria-describedby="content-help char-count"
            />
            <div id="content-help" className="help-text">
              Tip: Press Ctrl+Enter (or Cmd+Enter on Mac) to quickly create paste
            </div>
            <div id="char-count" className={`char-count ${charCountClass}`}>
              {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="ttl">Time to Live (seconds)</label>
            <input
              type="number"
              id="ttl"
              value={ttlSeconds}
              onChange={(e) => setTtlSeconds(e.target.value)}
              min="1"
              max={365 * 24 * 60 * 60}
              placeholder="Optional"
              disabled={loading}
              aria-describedby="ttl-help"
            />
            <div id="ttl-help" className="help-text">
              Leave empty for no expiration. Maximum: 1 year (31,536,000 seconds)
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="maxViews">Maximum Views (API fetches only)</label>
            <input
              type="number"
              id="maxViews"
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
              min="1"
              max={1000000}
              placeholder="Optional"
              disabled={loading}
              aria-describedby="views-help"
            />
            <div id="views-help" className="help-text">
              Leave empty for unlimited views. HTML page views don't count.
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || !content.trim()}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div>
                Creating...
              </>
            ) : (
              <>
                <span>📤</span>
                Create Paste
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Instructions */}
      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>How it works</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li><strong>Content:</strong> Enter any text you want to share</li>
          <li><strong>Time to Live:</strong> Set an expiration time in seconds (optional)</li>
          <li><strong>Max Views:</strong> Limit how many times the paste can be fetched via API (optional)</li>
          <li><strong>Share:</strong> Get a unique URL to share with others</li>
        </ul>
        
        <div className="alert alert-info" style={{ marginTop: 20 }}>
          <span>ℹ️</span>
          <div className="alert-content">
            <strong>Note:</strong> Viewing the paste in a browser doesn't count toward the view limit. 
            Only API fetches (GET /api/pastes/:id) decrement the view count.
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePaste;
