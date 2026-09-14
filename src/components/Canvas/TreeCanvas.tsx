import React, { useState, useRef, useEffect } from 'react';
import type { TreeData, LayoutNode, TreeLayout, LayoutStyle } from '../../types/tree';
import { PersonCard } from './PersonCard';
import { ConnectorLines } from './ConnectorLines';
import { FamilyGroupEnclosures } from './FamilyGroupEnclosures';

interface TreeCanvasProps {
  tree: TreeData;
  layout: TreeLayout;
  layoutStyle?: LayoutStyle;
  selectedPersonId: string | null;
  comparisonPersonId?: string | null;
  relationshipPathIds?: string[];
  onSelectPerson: (personId: string | null, event?: React.MouseEvent) => void;
  onUpdatePersonPosition: (personId: string, x: number, y: number) => void;
  onAddChild: (personId: string) => void;
  onAddPartner: (personId: string) => void;
  onAddSibling: (personId: string) => void;
  onAddParent: (personId: string) => void;
  onAddChildToUnion?: (unionId: string) => void;
  onSelectUnion?: (unionId: string) => void;
  onToggleCollapse?: (personId: string) => void;
  onFinishDragPerson?: (personId: string) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  temporalYear?: number | null;
  activeMoment?: any | null;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({
  tree: _tree,
  layout,
  layoutStyle = 'vertical',
  selectedPersonId,
  comparisonPersonId,
  relationshipPathIds = [],
  onSelectPerson,
  onUpdatePersonPosition,
  onAddChild,
  onAddPartner,
  onAddSibling,
  onAddParent,
  onAddChildToUnion,
  onSelectUnion,
  onToggleCollapse,
  onFinishDragPerson,
  zoom,
  setZoom,
  pan,
  setPan,
  canvasContainerRef,
  temporalYear = null,
  activeMoment = null,
}) => {
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);

  // Dragging Canvas (Panning)
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging a Person Card
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });
  const hasMovedCardRef = useRef(false);

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Non-passive wheel listener attached to container to allow e.preventDefault() without console errors
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 2.5);

      if (newZoom === currentZoom) return;

      // Adjust pan so the point under the cursor stays stationary
      const newPanX = mouseX - (mouseX - currentPan.x) * (newZoom / currentZoom);
      const newPanY = mouseY - (mouseY - currentPan.y) * (newZoom / currentZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, [canvasContainerRef, setZoom, setPan]);

  // Mouse Down on Canvas (Start Panning)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking on empty background
    if (e.target === canvasContainerRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      onSelectPerson(null);
    }
  };

  // Mouse Down on a Card (Start Dragging Node)
  const handleCardDragStart = (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    const node = layout.nodes[personId];
    if (!node) return;

    setDraggingPersonId(personId);
    hasMovedCardRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  // Global Mouse Move & Mouse Up
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      } else if (draggingPersonId) {
        const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;

        if (Math.hypot(dx, dy) > 4) {
          hasMovedCardRef.current = true;
        }

        const newX = dragStartRef.current.nodeX + dx;
        const newY = dragStartRef.current.nodeY + dy;

        onUpdatePersonPosition(draggingPersonId, newX, newY);
      }
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }
      if (draggingPersonId) {
        if (hasMovedCardRef.current && onFinishDragPerson) {
          onFinishDragPerson(draggingPersonId);
        }
        setDraggingPersonId(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, draggingPersonId, zoom, setPan, onUpdatePersonPosition, onFinishDragPerson]);

  return (
    <div
      ref={canvasContainerRef}
      onMouseDown={handleMouseDown}
      className={`relative w-full h-full overflow-hidden bg-slate-50 canvas-background ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Background Architectural Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40 canvas-background"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dot-grid"
            width={32 * zoom}
            height={32 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % (32 * zoom)}, ${pan.y % (32 * zoom)})`}
          >
            <circle cx={1.5} cy={1.5} r={1.2} fill="#94a3b8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Transformed Canvas Plane */}
      <div
        id="tree-capture-plane"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
        className="canvas-plane"
      >
        {/* Family Group Enclosures & Badges */}
        <FamilyGroupEnclosures familyGroups={layout.familyGroups} />

        {/* SVG Connector Lines and Union Anchors */}
        <ConnectorLines
          edges={layout.edges}
          unions={layout.unions}
          selectedPersonId={selectedPersonId}
          hoveredPersonId={hoveredPersonId}
          layoutStyle={layoutStyle}
          temporalYear={temporalYear}
          onAddChildToUnion={onAddChildToUnion}
          onSelectUnion={onSelectUnion}
        />

        {/* HTML Interactive Person Cards */}
        {Object.values(layout.nodes).map((node: LayoutNode) => {
          const person = node.data;
          const hasDescendants = (person.unionIds || []).some(
            (uId) => (_tree.unions[uId]?.childrenIds?.length || 0) > 0
          );

          const isRoomHonoree = Boolean(
            activeMoment &&
              ((activeMoment.personId && activeMoment.personId === node.id) ||
                (activeMoment.unionId && _tree.unions[activeMoment.unionId]?.partnerIds.includes(node.id)))
          );

          return (
            <PersonCard
              key={node.id}
              node={node}
              layoutStyle={layoutStyle}
              isSelected={selectedPersonId === node.id}
              isCompared={comparisonPersonId === node.id}
              isOnRelationshipPath={relationshipPathIds.includes(node.id)}
              hasActiveComparison={Boolean(selectedPersonId && comparisonPersonId)}
              isHovered={hoveredPersonId === node.id}
              hasDescendants={hasDescendants}
              temporalYear={temporalYear}
              isRoomHonoree={isRoomHonoree}
              activeMoment={activeMoment}
              onToggleCollapse={onToggleCollapse}
              onSelect={(id, e) => {
                if (!hasMovedCardRef.current) {
                  onSelectPerson(id, e);
                }
              }}
              onHover={setHoveredPersonId}
              onAddChild={onAddChild}
              onAddPartner={onAddPartner}
              onAddSibling={onAddSibling}
              onAddParent={onAddParent}
              onDragStart={handleCardDragStart}
            />
          );
        })}
      </div>
    </div>
  );
};
