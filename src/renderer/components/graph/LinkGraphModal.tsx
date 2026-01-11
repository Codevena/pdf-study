import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import type { LinkGraph, GraphNode, GraphEdge } from '../../../shared/types';

interface LinkGraphModalProps {
  onClose: () => void;
  onNavigateToPdf?: (pdfId: number) => void;
}

interface GraphData {
  nodes: Array<GraphNode & { x?: number; y?: number }>;
  links: Array<{ source: string; target: string; value: number }>;
}

export default function LinkGraphModal({ onClose, onNavigateToPdf }: LinkGraphModalProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeUnlinked, setIncludeUnlinked] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch graph data
  useEffect(() => {
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const data: LinkGraph = await window.electronAPI.getLinkGraph(includeUnlinked);
        setGraphData({
          nodes: data.nodes,
          links: data.edges.map((e) => ({
            source: e.source,
            target: e.target,
            value: e.value,
          })),
        });
      } catch (error) {
        console.error('Failed to fetch link graph:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, [includeUnlinked]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Center graph on load
  useEffect(() => {
    if (graphRef.current && graphData && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (onNavigateToPdf) {
        onNavigateToPdf(node.pdfId);
        onClose();
      }
    },
    [onNavigateToPdf, onClose]
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'grab';
    }
  }, []);

  // Node color based on link count
  const getNodeColor = (node: GraphNode): string => {
    if (node.linkCount === 0) return '#9ca3af'; // gray-400
    if (node.linkCount <= 2) return '#3b82f6'; // blue-500
    if (node.linkCount <= 5) return '#8b5cf6'; // violet-500
    return '#ec4899'; // pink-500
  };

  // Node size based on link count
  const getNodeSize = (node: GraphNode): number => {
    return Math.max(6, Math.min(20, 6 + node.linkCount * 2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-violet-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <h2 className="text-xl font-semibold dark:text-white">Wissensgraph</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle for unlinked PDFs */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnlinked}
                onChange={(e) => setIncludeUnlinked(e.target.checked)}
                className="w-4 h-4 text-violet-500 rounded focus:ring-violet-500"
              />
              <span>Alle PDFs anzeigen</span>
            </label>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Graph Container */}
        <div ref={containerRef} className="flex-1 relative bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="w-8 h-8 animate-spin text-violet-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-gray-500 dark:text-gray-400">Graph wird geladen...</span>
              </div>
            </div>
          ) : graphData && graphData.nodes.length > 0 ? (
            <>
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                nodeId="id"
                nodeLabel={(node: GraphNode) =>
                  `${node.label}\n${node.linkCount} Verbindung${node.linkCount !== 1 ? 'en' : ''}`
                }
                nodeColor={(node: GraphNode) => getNodeColor(node)}
                nodeVal={(node: GraphNode) => getNodeSize(node)}
                linkWidth={(link: { value: number }) => Math.max(1, Math.min(5, link.value))}
                linkColor={() => '#94a3b8'}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={(link: { value: number }) =>
                  Math.max(2, Math.min(4, link.value))
                }
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                backgroundColor="transparent"
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />

              {/* Hover tooltip */}
              {hoveredNode && (
                <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-3 pointer-events-none">
                  <div className="font-medium dark:text-white">{hoveredNode.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {hoveredNode.linkCount} Verbindung{hoveredNode.linkCount !== 1 ? 'en' : ''}
                  </div>
                  <div className="text-xs text-violet-500 mt-1">Klicken zum Öffnen</div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
                <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-violet-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Keine Verbindungen gefunden
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Verbinde deine PDFs mit Wiki-Links in deinen Notizen
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left w-full shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    So erstellst du Verbindungen:
                  </p>
                  <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-medium">
                        1
                      </span>
                      <span>Offne ein PDF und wechsle zur Notizen-Ansicht</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-medium">
                        2
                      </span>
                      <span>
                        Schreibe in einer Notiz:{' '}
                        <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-violet-600 dark:text-violet-400 font-mono text-xs">
                          [[AnderesPDF#p10]]
                        </code>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-medium">
                        3
                      </span>
                      <span>Die Verbindung erscheint automatisch im Graph</span>
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Tipp: Tippe <code className="font-mono">[[</code> um Autovervollstandigung zu
                  aktivieren
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with legend */}
        <div className="px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                <span>Keine Links</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>1-2 Links</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500" />
                <span>3-5 Links</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500" />
                <span>6+ Links</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {graphData?.nodes.length || 0} PDFs · {graphData?.links.length || 0} Verbindungen
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
