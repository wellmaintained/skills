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

  const handleDragStop = useCallback<NodeDragHandler>(
    (_event, node) => {
      const overlaps = reactFlow.getIntersectingNodes(node, true);
      const target = overlaps.find((candidate) => candidate.id !== node.id);
      if (target) {
        onDropReparent(node.id, target.id);
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
        nodeDragHandle=".drag-handle"
        onNodeDragStop={handleDragStop}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        panOnScroll
        nodesDraggable
        className="bg-slate-50"
      >
        <Background gap={24} size={1} color="#CBD5F5" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
