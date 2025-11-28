import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ClientLogger } from '../utils/logger';

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
  const logger = new ClientLogger('Canvas');
  const [isSpacePressed, setIsSpacePressed] = useState(false);

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

      if (event.key === ' ' && !isSpacePressed) {
        event.preventDefault();
        setIsSpacePressed(true);
        document.body.style.cursor = 'grab';
      }
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
      logger.debug('Drag started for node', { nodeId: node.id });
    },
    [logger]
  );

  const handleDragStop = useCallback<NodeDragHandler>(
    (_event, node) => {
      logger.debug('Drag stopped for node', { nodeId: node.id });
      logger.debug('Dragged node position', { position: node.position });
      logger.debug('Dragged node dimensions', { width: node.width, height: node.height });
      
      // Get the center point of the dragged node
      const nodeWidth = node.width || 260;
      const nodeHeight = node.height || 150;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;
      
      logger.debug('Dragged node center', { x: nodeCenterX, y: nodeCenterY });
      
      // Find the node that contains this center point
      const allNodes = reactFlow.getNodes();
      logger.debug('Checking nodes for intersection', { nodeCount: allNodes.length });
      
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
          logger.debug('Found target node', {
            targetId: candidate.id,
            targetPosition: candidate.position,
            targetDimensions: { width: candidateWidth, height: candidateHeight },
            centerPoint: {
              centerX: nodeCenterX,
              centerY: nodeCenterY,
              bounds: {
                left: candidateX,
                right: candidateX + candidateWidth,
                top: candidateY,
                bottom: candidateY + candidateHeight,
              },
            },
          });
        } else {
          // Log why it didn't match for debugging
          const distanceX = Math.min(Math.abs(nodeCenterX - candidateX), Math.abs(nodeCenterX - (candidateX + candidateWidth)));
          const distanceY = Math.min(Math.abs(nodeCenterY - candidateY), Math.abs(nodeCenterY - (candidateY + candidateHeight)));
          if (distanceX < 100 && distanceY < 100) {
            logger.debug('Close but not overlapping', {
              candidateId: candidate.id,
              distanceX,
              distanceY,
              candidatePos: candidate.position,
            });
          }
        }
        
        return isWithinBounds;
      });
      
      if (target) {
        logger.info('Reparenting', { childId: node.id, parentId: target.id });
        onDropReparent(node.id, target.id);
      } else {
        logger.debug('No target found for reparenting', {
          allNodes: allNodes.map((n) => ({
            id: n.id,
            pos: n.position,
            size: { w: n.width || 260, h: n.height || 150 },
          })),
        });
      }
    },
    [onDropReparent, reactFlow, logger]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
         nodes={nodes}
         edges={edges}
         nodeTypes={nodeTypes}
         proOptions={{ hideAttribution: true }}
         onNodeDragStart={handleDragStart}
         onNodeDragStop={handleDragStop}
         fitView
         zoomOnScroll={true}
         zoomOnPinch={true}
         minZoom={0.2}
         maxZoom={2.5}
         panOnDrag={[0, 1, 2]}
         panOnScroll={false}
         nodesDraggable={true}
         className="bg-slate-50"
         style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
       >
        <Background gap={24} size={1} color="#CBD5F5" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
