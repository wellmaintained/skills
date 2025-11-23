# Mouse Zoom and Pan Controls Design

**Date**: 2025-11-23
**Issue**: wms-083
**Component**: beads-bridge interactive visualization (Canvas.tsx)

## Overview

Make zoom and pan more intuitive. Scroll wheel zooms instead of panning. Multiple methods support panning.

## Current Behavior

- Mouse wheel scrolls to pan the canvas (`panOnScroll={true}`)
- Zoom limited to 0.2x - 2.5x
- ReactFlow Controls widget provides zoom buttons
- Node dragging via drag handle works correctly

## New Control Scheme

### Zoom Controls
- **Mouse wheel** → zooms to cursor position
- **Trackpad pinch** → two-finger pinch gesture
- **Keyboard +/-** → zoom in/out with animation
- **UI controls** → ReactFlow Controls widget (unchanged)
- **Limits** → 0.2x - 2.5x
- **Sensitivity** → 2

### Pan Controls
- **Background drag** → click empty space and drag
- **Middle mouse button** → middle-click and drag
- **Spacebar + drag** → hold spacebar, drag with any mouse button
- **Keyboard arrows** → pan 50px in arrow direction

## Implementation Details

### 1. ReactFlow Configuration Changes

**File**: `src/client/src/components/Canvas.tsx`

Modify ReactFlow component props (lines 149-170):

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  proOptions={{ hideAttribution: true }}
  nodeDragHandle="[data-handleid='drag-handle']"
  onNodeDragStart={handleDragStart}
  onNodeDragStop={handleDragStop}
  fitView

  // Zoom configuration
  zoomOnScroll={true}              // Enable scroll-to-zoom
  zoomOnPinch={true}               // Enable trackpad pinch
  minZoom={0.2}
  maxZoom={2.5}

  // Pan configuration
  panOnDrag={isSpacePressed ? [0, 1, 2] : [2]}  // All buttons when space pressed, otherwise middle only
  panOnScroll={false}              // Disable scroll panning (replaced by zoom)

  // Node dragging
  nodesDraggable={true}

  className="bg-slate-50"
  style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
>
  <Background gap={24} size={1} color="#CBD5F5" />
  <Controls showInteractive={false} />
</ReactFlow>
```

### 2. Keyboard Shortcuts

Add keyboard event handling in `CanvasInner` component:

```tsx
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Skip if user is typing in an input field
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const { key } = event;

    // Zoom shortcuts
    if (key === '+' || key === '=') {
      event.preventDefault();
      reactFlow.zoomIn({ duration: 200 });
    } else if (key === '-' || key === '_') {
      event.preventDefault();
      reactFlow.zoomOut({ duration: 200 });
    }

    // Pan shortcuts (arrow keys)
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const panAmount = 50; // pixels to pan
      const viewport = reactFlow.getViewport();

      const newViewport = { ...viewport };
      if (key === 'ArrowUp') newViewport.y += panAmount;
      if (key === 'ArrowDown') newViewport.y -= panAmount;
      if (key === 'ArrowLeft') newViewport.x += panAmount;
      if (key === 'ArrowRight') newViewport.x -= panAmount;

      reactFlow.setViewport(newViewport, { duration: 200 });
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [reactFlow]);
```

### 3. Spacebar + Drag

Track spacebar state and modify pan behavior:

```tsx
const [isSpacePressed, setIsSpacePressed] = useState(false);

useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Skip if user is typing in an input field
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.key === ' ' && !isSpacePressed) {
      event.preventDefault();
      setIsSpacePressed(true);
      document.body.style.cursor = 'grab';
    }

    // ... existing zoom/pan keyboard shortcuts ...
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault();
      setIsSpacePressed(false);
      document.body.style.cursor = 'default';
    }
  };

  // Cleanup cursor if user switches windows while holding space
  const handleBlur = () => {
    setIsSpacePressed(false);
    document.body.style.cursor = 'default';
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
    document.body.style.cursor = 'default'; // Ensure cleanup
  };
}, [isSpacePressed, reactFlow]);
```

**Spacebar pan logic**: `panOnDrag` accepts mouse button codes (0=left, 1=middle, 2=right). Spacebar held enables all buttons; spacebar released limits panning to middle button.

## Testing Checklist

Manual verification required:

- [ ] Mouse wheel zooms toward cursor position
- [ ] Trackpad pinch gesture zooms in/out
- [ ] Left-click and drag on background pans
- [ ] Middle-click and drag pans
- [ ] Spacebar + any mouse drag pans
- [ ] Cursor changes to 'grab' when spacebar held
- [ ] Cursor resets when spacebar released or window loses focus
- [ ] Plus/minus keys zoom in/out
- [ ] Arrow keys pan in all directions
- [ ] Node dragging via handle still works (doesn't trigger pan)
- [ ] ReactFlow Controls widget buttons still work
- [ ] Keyboard shortcuts don't fire when typing in modal/input fields
- [ ] No conflicts between node drag and pan modes

## Edge Cases

1. **Input field focus**: Check `event.target` to ignore keystrokes in input fields
2. **Window blur**: Reset spacebar state and cursor on window blur
3. **Cursor restoration**: Clean up cursor in useEffect return
4. **Node drag handle**: `nodeDragHandle` prop prevents pan conflicts

## Unchanged Behaviors

- Zoom limits remain 0.2x - 2.5x
- ReactFlow Controls widget stays visible
- Node reparenting via drag-and-drop still works
- Auto-fit view on node addition unchanged
