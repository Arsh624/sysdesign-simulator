import { useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useDesignStore, type SystemNodeData } from "../store/designStore";
import SystemNode from "./SystemNode";
import { readDraggedComponent } from "./dnd";
import FlowOverlay from "./FlowOverlay";

const NODE_TYPES = { system: SystemNode };

export function Canvas() {
  const nodes = useDesignStore((s) => s.nodes);
  const edges = useDesignStore((s) => s.edges);
  const onNodesChange = useDesignStore((s) => s.onNodesChange);
  const onEdgesChange = useDesignStore((s) => s.onEdgesChange);
  const onConnect = useDesignStore((s) => s.onConnect);
  const addNode = useDesignStore((s) => s.addNode);
  const setSelected = useDesignStore((s) => s.setSelected);

  const { screenToFlowPosition } = useReactFlow();

  const handleNodeClick: NodeMouseHandler<Node<SystemNodeData>> = useCallback(
    (_, node) => {
      setSelected(node.id);
    },
    [setSelected]
  );

  const handlePaneClick = useCallback(() => {
    setSelected(null);
  }, [setSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = readDraggedComponent(e);
      if (!id) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(id, pos);
    },
    [addNode, screenToFlowPosition]
  );

  return (
    <div className="w-full h-full relative" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <FlowOverlay />
    </div>
  );
}

export function CanvasWithProvider() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

export default CanvasWithProvider;
