import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodeCard, { type IssueNodeComponentData } from './NodeCard';

const nodeTypes = {
  issueNode: NodeCard,
};

interface CanvasProps {
  nodes: Node<IssueNodeComponentData>[];
  edges: Edge[];
  onRegisterFit: (fn: () => void) => void;
  onDropReparent: (childId: string, parentId: string) => void;
}

export function Canvas({ nodes, edges, onRegisterFit, onDropReparent }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner nodes={nodes} edges={edges} onRegisterFit={onRegisterFit} onDropReparent={onDropReparent} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ nodes, edges, onRegisterFit, onDropReparent }: CanvasProps) {
  const reactFlow = useReactFlow();
  const previousNodeCountRef = useRef(nodes.length);

  useEffect(() => {
    onRegisterFit(() => reactFlow.fitView({ padding: 0.3, duration: 500 }));
  }, [onRegisterFit, reactFlow]);

  useEffect(() => {
    const currentNodeCount = nodes.length;
    const previousNodeCount = previousNodeCountRef.current;
    
    // Only fit view if nodes were added (count increased)
    if (currentNodeCount > previousNodeCount && currentNodeCount > 0) {
      // Use requestAnimationFrame to ensure ReactFlow has finished rendering
      // the new nodes before calling fitView
      requestAnimationFrame(() => {
        reactFlow.fitView({ padding: 0.3, duration: 500 });
      });
    }
    
    previousNodeCountRef.current = currentNodeCount;
  }, [nodes.length, reactFlow]);

  const handleDragStart = useCallback<NodeDragHandler>(
    (_event, node) => {
      // Ensure the node is being dragged from the drag handle
      console.log('[Canvas] Drag started for node:', node.id);
    },
    []
  );

  const handleDragStop = useCallback<NodeDragHandler>(
    (_event, node) => {
      console.log('[Canvas] Drag stopped for node:', node.id);
      console.log('[Canvas] Dragged node position:', node.position);
      console.log('[Canvas] Dragged node dimensions:', { width: node.width, height: node.height });
      
      // Get the center point of the dragged node
      const nodeWidth = node.width || 260;
      const nodeHeight = node.height || 150;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;
      
      console.log('[Canvas] Dragged node center:', { x: nodeCenterX, y: nodeCenterY });
      
      // Find the node that contains this center point
      const allNodes = reactFlow.getNodes();
      console.log('[Canvas] Checking', allNodes.length, 'nodes for intersection...');
      
      const target = allNodes.find((candidate) => {
        if (candidate.id === node.id) return false;
        
        const candidateX = candidate.position.x;
        const candidateY = candidate.position.y;
        const candidateWidth = candidate.width || 260;
        const candidateHeight = candidate.height || 150;
        
        // Check if the dragged node's center is within the candidate node's bounds
        const isWithinBounds =
          nodeCenterX >= candidateX &&
          nodeCenterX <= candidateX + candidateWidth &&
          nodeCenterY >= candidateY &&
          nodeCenterY <= candidateY + candidateHeight;
        
        if (isWithinBounds) {
          console.log('[Canvas] ✓ Found target node:', candidate.id);
          console.log('[Canvas]   Target position:', candidate.position);
          console.log('[Canvas]   Target dimensions:', { width: candidateWidth, height: candidateHeight });
          console.log('[Canvas]   Center point check:', {
            centerX: nodeCenterX,
            centerY: nodeCenterY,
            bounds: {
              left: candidateX,
              right: candidateX + candidateWidth,
              top: candidateY,
              bottom: candidateY + candidateHeight
            }
          });
        } else {
          // Log why it didn't match for debugging
          const distanceX = Math.min(Math.abs(nodeCenterX - candidateX), Math.abs(nodeCenterX - (candidateX + candidateWidth)));
          const distanceY = Math.min(Math.abs(nodeCenterY - candidateY), Math.abs(nodeCenterY - (candidateY + candidateHeight)));
          if (distanceX < 100 && distanceY < 100) {
            console.log('[Canvas]   Close but not overlapping:', candidate.id, {
              distanceX,
              distanceY,
              candidatePos: candidate.position
            });
          }
        }
        
        return isWithinBounds;
      });
      
      if (target) {
        console.log('[Canvas] ✓✓✓ Reparenting', node.id, 'to', target.id);
        onDropReparent(node.id, target.id);
      } else {
        console.log('[Canvas] ✗ No target found for reparenting');
        console.log('[Canvas] All nodes:', allNodes.map(n => ({
          id: n.id,
          pos: n.position,
          size: { w: n.width || 260, h: n.height || 150 }
        })));
      }
    },
    [onDropReparent, reactFlow]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        nodeDragHandle="[data-handleid='drag-handle']"
        onNodeDragStart={handleDragStart}
        onNodeDragStop={handleDragStop}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        panOnScroll
        nodesDraggable={true}
        className="bg-slate-50"
      >
        <Background gap={24} size={1} color="#CBD5F5" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
