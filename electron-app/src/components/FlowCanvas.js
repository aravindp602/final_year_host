// import React, { useCallback, useState, useEffect } from "react";
// import ReactFlow, {
//   ReactFlowProvider,
//   addEdge,
//   Background,
//   Controls,
//   applyNodeChanges,
//   applyEdgeChanges,
//   MiniMap,
//   Handle,
//   Position,
//   useReactFlow,   // ✅ import hook
// } from "reactflow";
// import "reactflow/dist/style.css";
// const nodeStyle = {
//   border: "1px solid #555",
//   padding: 10,
//   borderRadius: 12,
//   background: "#fff",
//   boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
//   fontSize: 14,
//   minWidth: 120,
//   textAlign: "center",
//   position: "relative",
// };

// const CustomNode = ({ data }) => {
//   return (
//     <div
//       style={{
//         ...nodeStyle,
//         minWidth: 180,
//         minHeight: 60,
//         padding: "12px 16px",
//         borderRadius: 16,
//         display: "flex",
//         justifyContent: "center",
//         alignItems: "center",
//         textAlign: "center",
//         flexDirection: "column",
//         position: "relative",
//       }}
//     >
//       <button
//         onClick={data.onDelete}
//         style={{
//           position: "absolute",
//           top: -10,
//           right: -10,
//           width: 22,
//           height: 22,
//           borderRadius: "50%",
//           border: "none",
//           background: "#e74c3c",
//           color: "#fff",
//           fontWeight: "bold",
//           cursor: "pointer",
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
//         }}
//       >
//         ×
//       </button>

//       <Handle
//         type="target"
//         position={Position.Left}
//         style={{ background: "#555", width: 12, height: 12, borderRadius: "50%" }}
//       />
//       <Handle
//         type="source"
//         position={Position.Right}
//         style={{ background: "#555", width: 12, height: 12, borderRadius: "50%" }}
//       />

//       <strong>{data.label}</strong>
//     </div>
//   );
// };

// const nodeTypes = { custom: CustomNode };

// const FlowCanvasInner = () => {
//   const [nodes, setNodes] = useState([]);
//   const [edges, setEdges] = useState([]);
//   const { fitView, project } = useReactFlow(); // project converts screen coords to flow coords

//   useEffect(() => {
//     fetch("http://localhost:5001/preprocessing-graph")
//       .then((res) => res.json())
//       .then((data) => {
//         const backendNodes = data.nodes.map((n, idx) => ({
//           id: n.id,
//           type: "custom",
//           position: { x: idx * 350, y: 200 },
//           data: {
//             label: n.label,
//             onDelete: () => {
//               setNodes((nds) => nds.filter((node) => node.id !== n.id));
//               setEdges((eds) =>
//                 eds.filter((e) => e.source !== n.id && e.target !== n.id)
//               );
//             },
//           },
//         }));

//         const backendEdges = data.edges.map((e) => ({
//           id: e.id,
//           source: e.source,
//           target: e.target,
//           animated: true,
//           markerEnd: { type: "arrowclosed" },
//           style: { stroke: "#000", strokeWidth: 3 },
//         }));

//         setNodes(backendNodes);
//         setEdges(backendEdges);

//         setTimeout(() => fitView(), 300);
//       })
//       .catch((err) => console.error("Error fetching preprocessing graph", err));
//   }, [fitView]);

//   // Handle drop of a module
//   const onDrop = useCallback(
//     (event) => {
//       event.preventDefault();
//       const reactFlowBounds = event.currentTarget.getBoundingClientRect();
//       const type = JSON.parse(event.dataTransfer.getData("application/reactflow"));

//       if (!type) return;

//       const position = project({
//         x: event.clientX - reactFlowBounds.left,
//         y: event.clientY - reactFlowBounds.top,
//       });

//       const newNode = {
//         id: `node_${+new Date()}`,
//         type: "custom",
//         position,
//         data: {
//           label: type.label,
//           onDelete: () =>
//             setNodes((nds) => nds.filter((n) => n.id !== newNode.id)),
//         },
//       };

//       setNodes((nds) => nds.concat(newNode));
//     },
//     [project]
//   );

//   const onDragOver = useCallback((event) => {
//     event.preventDefault();
//     event.dataTransfer.dropEffect = "move";
//   }, []);

//   return (
//     <div
//       style={{ flex: 1, height: "100vh", position: "relative" }}
//       onDrop={onDrop}
//       onDragOver={onDragOver}
//     >
//       {/* Run Configuration button */}
//       <button
//         onClick={async () => {
//           const payload = { nodes, edges };
//           try {
//             const res = await fetch("http://localhost:5001/run-config", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify(payload),
//             });
//             const result = await res.json();
//             console.log("Run Config result:", result);
//             alert("Configuration sent successfully!");
//           } catch (err) {
//             console.error("Error running configuration:", err);
//           }
//         }}
//         style={{
//           position: "absolute",
//           top: 10,
//           right: 10,
//           zIndex: 10,
//           padding: "8px 16px",
//           background: "#e20606ff",
//           color: "white",
//           border: "none",
//           borderRadius: 6,
//           cursor: "pointer",
//         }}
//       >
//         Run Configuration
//       </button>

//       <ReactFlow
//         nodes={nodes}
//         edges={edges}
//         onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
//         onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
//         onConnect={(params) =>
//           setEdges((eds) =>
//             addEdge(
//               {
//                 ...params,
//                 animated: true,
//                 markerEnd: { type: "arrowclosed" },
//                 style: { stroke: "#000", strokeWidth: 3 },
//               },
//               eds
//             )
//           )
//         }
//         nodeTypes={nodeTypes}
//         fitView
//       >
//         <MiniMap />
//         <Background />
//         <Controls />
//       </ReactFlow>
//     </div>
//   );
// };

// const FlowCanvas = () => (
//   <ReactFlowProvider>
//     <FlowCanvasInner />
//   </ReactFlowProvider>
// );

// export default FlowCanvas;