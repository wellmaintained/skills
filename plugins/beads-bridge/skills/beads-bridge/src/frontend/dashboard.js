// Get issue ID from URL
const issueId = window.location.pathname.split('/').pop();

// State
let issuesMap = new Map();
let eventSource = null;
let currentZoom = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.1;

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  look: 'handDrawn',
  elk: {
    'nodeLabels.width': 300
  }
});

// Fetch initial state
async function fetchInitialState() {
  try {
    console.log(`Fetching initial state for issue: ${issueId}`);
    const response = await fetch(`/api/issue/${issueId}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || 'Issue not found'}`);
    }

    const data = await response.json();
    console.log('Initial state loaded:', { 
      hasDiagram: !!data.diagram, 
      diagramLength: data.diagram?.length || 0,
      metrics: data.metrics,
      issueCount: data.issues?.length || 0
    });
    updateDashboard(data);
  } catch (error) {
    console.error('Failed to load issue:', error);
    showError(`Failed to load issue: ${error.message}`);
  }
}

// Connect to SSE
function connectSSE() {
  eventSource = new EventSource(`/api/issue/${issueId}/events`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'connected') {
      console.log('Connected to live updates');
    } else if (data.type === 'update') {
      updateDashboard(data.data);
    } else if (data.type === 'error') {
      showError(data.message);
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection lost, reconnecting...');
    setTimeout(() => {
      if (eventSource) {
        eventSource.close();
      }
      connectSSE();
    }, 2000);
  };
}

// Update dashboard with new data
async function updateDashboard(data) {
  hideError();

  console.log('Updating dashboard with data:', {
    hasDiagram: !!data.diagram,
    diagramLength: data.diagram?.length || 0,
    metrics: data.metrics
  });

  // Update metrics
  document.getElementById('completed-metric').textContent =
    `${data.metrics.completed}/${data.metrics.total} completed`;
  document.getElementById('blocked-metric').textContent =
    `${data.metrics.blocked} blocked`;
  document.getElementById('last-update').textContent =
    `Last update: ${new Date(data.lastUpdate).toLocaleTimeString()}`;

  // Update issues map
  issuesMap = new Map(data.issues.map(issue => [issue.id, issue]));

  // Render mermaid diagram
  if (!data.diagram || data.diagram.trim() === '') {
    console.warn('No diagram data provided');
    showError('No diagram data available');
    return;
  }

  await renderDiagram(data.diagram);

  // Hide loading (graph container is already shown by renderDiagram)
  console.log('Hiding loading');
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.classList.add('hidden');
    console.log('Loading element classes:', loadingEl.className);
  }
}

// Render mermaid diagram with click handlers
async function renderDiagram(diagram) {
  const graphElement = document.getElementById('graph');
  const graphContainer = document.getElementById('graph-container');

  if (!diagram || diagram.trim() === '') {
    throw new Error('Empty diagram provided');
  }

  console.log('Rendering diagram, length:', diagram.length);

  // Make sure container is visible before rendering (Mermaid needs this)
  graphContainer.classList.remove('hidden');
  
  // Clear any previous content
  graphElement.innerHTML = '';

  // --- START: DYNAMIC STYLING ---
  const classDefs = `
    classDef completed fill:#d4edda,stroke:#c3e6cb,color:#155724;
    classDef in_progress fill:#cce5ff,stroke:#b8daff,color:#004085;
    classDef blocked fill:#f8d7da,stroke:#f5c6cb,color:#721c24;
    classDef default fill:#f8f9fa,stroke:#dee2e6,color:#383d41;
  `;

  const lines = diagram.trim().split('\n');
  const diagramType = lines.shift() || 'flowchart TD';
  
  const nodeRegex = /^\s*([\w.-]+)\[/;
  
  // First pass: identify all completed nodes from the diagram text
  const completedNodes = new Set();
  for (const line of lines) {
    if (line.includes('☑')) {
      const match = line.match(nodeRegex);
      if (match) {
        completedNodes.add(match[1]);
      }
    }
  }

  // Second pass: build the styled diagram
  const styledLines = [];

  for (const line of lines) {
    const nodeMatch = line.match(nodeRegex);

    if (nodeMatch) {
      const issueId = nodeMatch[1];
      const issue = issuesMap.get(issueId);
      let statusClass = 'default';
      
      if (completedNodes.has(issueId)) {
        statusClass = 'completed';
      } else if (issue) {
        const status = issue.metadata?.beadsStatus || issue.state || 'unknown';
        if (status === 'in_progress') {
          statusClass = 'in_progress';
        } else if (status === 'blocked') {
          statusClass = 'blocked';
        }
      }
      styledLines.push(line + `:::${statusClass}`);
    } else {
      styledLines.push(line);
    }
  }
  
  const finalDiagram = `${diagramType}\n${classDefs}\n${styledLines.join('\n')}`;
  // --- END: DYNAMIC STYLING ---

  try {
    // Generate unique ID for this diagram
    const diagramId = `mermaid-diagram-${Date.now()}`;
    
    // Mermaid v11 API - render the element
    const { svg } = await mermaid.render(diagramId, finalDiagram.trim());
    
    // Replace the text content with the rendered SVG
    graphElement.innerHTML = svg;
    
    // Ensure SVG scales properly
    const renderedSvg = graphElement.querySelector('svg');
    if (renderedSvg) {
      renderedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    console.log('Diagram rendered successfully');
    
    // Initialize zoom and pan after rendering
    updateTransform();
    
    // Add click handlers via DOM after rendering
    // Find all rendered nodes and add click listeners
    try {
      const renderedSvg = graphElement.querySelector('svg');
      if (renderedSvg) {
        const nodes = renderedSvg.querySelectorAll('.node');
        console.log('Found', nodes.length, 'nodes to add click handlers to');
        nodes.forEach(node => {
          const nodeId = node.getAttribute('id');
          if (nodeId) {
            // Extract issue ID from node ID (Mermaid adds prefixes)
            const issueIdMatch = nodeId.match(/(pensive-[\\w.]+)/);
            if (issueIdMatch) {
              const issueId = issueIdMatch[1];
              node.style.cursor = 'pointer';
              
              // Prevent panning when clicking on nodes
              const preventPan = (e) => {
                e.stopPropagation();
                if (isDragging) {
                  isDragging = false;
                  const mermaidWrapper = document.getElementById('mermaid-wrapper');
                  if (mermaidWrapper) {
                    mermaidWrapper.style.cursor = 'grab';
                  }
                }
              };
              
              node.addEventListener('mousedown', preventPan);
              node.addEventListener('click', (e) => {
                e.stopPropagation();
                window.showIssueDetails(issueId);
              });
              
              // Change cursor on hover
              node.addEventListener('mouseenter', () => {
                node.style.cursor = 'pointer';
              });
            }
          }
        });
      } else {
        console.warn('No SVG found after rendering');
      }
    } catch (clickError) {
      console.warn('Failed to add click handlers:', clickError);
      // Don't throw - diagram is still rendered
    }
  } catch (error) {
    console.error('Mermaid render error:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('Diagram content (first 500 chars):', finalDiagram.substring(0, 500));
    showError(`Failed to render diagram: ${error.message || 'Unknown error'}`);
    throw error;
  }
}

// Show issue details modal
window.showIssueDetails = function(nodeId) {
  const issue = issuesMap.get(nodeId);
  if (!issue) return;

  document.getElementById('modal-title').textContent = `${issue.id}: ${issue.title}`;
  
  // Backend uses 'state' for status, but also stores beadsStatus in metadata
  const status = issue.metadata?.beadsStatus || issue.state || 'unknown';
  document.getElementById('modal-status').textContent = status;
  
  // Backend uses 'body' for description
  const description = issue.body || issue.description || 'No description';
  document.getElementById('modal-description').textContent = description;

  // Show/hide notes section
  if (issue.notes) {
    document.getElementById('modal-notes').textContent = issue.notes;
    document.getElementById('modal-notes-section').classList.remove('hidden');
  } else {
    document.getElementById('modal-notes-section').classList.add('hidden');
  }

  document.getElementById('modal').classList.remove('hidden');
};

// Close modal
document.querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

document.querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('modal').classList.add('hidden');
  }
});

// Zoom and pan controls
function updateTransform() {
  const mermaidElement = document.getElementById('graph');
  if (mermaidElement) {
    mermaidElement.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    mermaidElement.style.transformOrigin = 'top left';
  }
  const zoomLevel = document.getElementById('zoom-level');
  if (zoomLevel) {
    zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
  }
}

function updateZoom(zoom) {
  currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  updateTransform();
}

function setPan(x, y) {
  panX = x;
  panY = y;
  updateTransform();
}

function zoomIn() {
  updateZoom(currentZoom + ZOOM_STEP);
}

function zoomOut() {
  updateZoom(currentZoom - ZOOM_STEP);
}

function zoomReset() {
  updateZoom(1.0);
}

// Error handling
function showError(message) {
  const banner = document.getElementById('error-banner');
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

// Initialize zoom controls
function initializeZoomControls() {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomResetBtn = document.getElementById('zoom-reset');
  
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', zoomIn);
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', zoomOut);
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      zoomReset();
      setPan(0, 0);
    });
  }
  
  // Mouse wheel zoom (no modifier key needed)
  const mermaidWrapper = document.getElementById('mermaid-wrapper');
  if (mermaidWrapper) {
    mermaidWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      updateZoom(currentZoom + delta);
    });
    
    // Click and drag panning
    mermaidWrapper.addEventListener('mousedown', (e) => {
      // Only start dragging if clicking on background (not on nodes)
      const target = e.target;
      const isNode = target.closest('.node') || target.classList.contains('node');
      
      // Don't start panning if clicking on a node
      if (!isNode && target !== mermaidWrapper) {
        // Check if we're clicking on SVG background elements
        const svg = target.closest('svg');
        if (svg && (target === svg || target.tagName === 'g' || target.tagName === 'rect')) {
          isDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          dragStartPanX = panX;
          dragStartPanY = panY;
          mermaidWrapper.style.cursor = 'grabbing';
          e.preventDefault();
        }
      } else if (target === mermaidWrapper) {
        // Clicking directly on wrapper background
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartPanX = panX;
        dragStartPanY = panY;
        mermaidWrapper.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    
    mermaidWrapper.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        // Increase sensitivity - multiply by 1.5 for more responsive panning
        const sensitivity = 1.5;
        setPan(dragStartPanX + deltaX * sensitivity, dragStartPanY + deltaY * sensitivity);
        e.preventDefault();
      }
    });
    
    mermaidWrapper.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        mermaidWrapper.style.cursor = 'grab';
      }
    });
    
    mermaidWrapper.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        mermaidWrapper.style.cursor = 'grab';
      }
    });
  }
}

// Initialize
fetchInitialState();
connectSSE();
initializeZoomControls();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});
