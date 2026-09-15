import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { TreeData, LayoutNode, TreeLayout, LayoutStyle } from '../../types/tree';
import { PersonCard } from './PersonCard';
import { ConnectorLines } from './ConnectorLines';
import { FamilyGroupEnclosures } from './FamilyGroupEnclosures';
import { ConnectionCable, type PortType } from './ConnectionCable';
import { QuickLinkMenu, type QuickLinkType } from './QuickLinkMenu';
import { MiniMap } from './MiniMap';
import { getPersonDisplayName } from '../../services/treeOperations';
import {
  calculatePinchTransform,
  getTouchDistance,
  getTouchMidpoint,
  type TouchCoord,
} from './canvasTouch';

interface TreeCanvasProps {
  tree: TreeData;
  layout: TreeLayout;
  layoutStyle?: LayoutStyle;
  selectedPersonId: string | null;
  selectedPersonIds?: Set<string>;
  comparisonPersonId?: string | null;
  relationshipPathIds?: string[];
  onSelectPerson: (personId: string | null, event?: React.MouseEvent) => void;
  onMultiSelectPeople?: (personIds: string[], append: boolean) => void;
  onPersonContextMenu?: (e: React.MouseEvent, personId: string) => void;
  onCanvasContextMenu?: (e: React.MouseEvent) => void;
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
  onQuickLink?: (sourcePersonId: string, targetPersonId: string, type: QuickLinkType) => void;
  onQuickSpawnRelative?: (
    sourcePersonId: string,
    portType: PortType,
    worldPosition: { x: number; y: number }
  ) => void;
  isMiniMapOpen?: boolean;
  onToggleMiniMap?: () => void;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({
  tree,
  layout,
  layoutStyle = 'vertical',
  selectedPersonId,
  selectedPersonIds,
  comparisonPersonId,
  relationshipPathIds = [],
  onSelectPerson,
  onMultiSelectPeople,
  onPersonContextMenu,
  onCanvasContextMenu,
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
  onQuickLink,
  onQuickSpawnRelative,
  isMiniMapOpen = true,
  onToggleMiniMap,
}) => {
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);

  // Interactive Cable Wiring & Port Connecting State
  const [connectingState, setConnectingState] = useState<{
    sourcePersonId: string;
    portType: PortType;
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    hoveredTargetPersonId: string | null;
    hasMoved: boolean;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const connectingStateRef = useRef(connectingState);

  useEffect(() => {
    connectingStateRef.current = connectingState;
  }, [connectingState]);

  // Floating QuickLink menu state
  const [quickLinkMenu, setQuickLinkMenu] = useState<{
    sourcePersonId: string;
    targetPersonId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Click suppression ref after dragging
  const suppressClickRef = useRef(false);

  // Container Dimensions for MiniMap
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
  });

  // Intercept click phase to suppress phantom clicks after dragging
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleClickCapture = (e: MouseEvent) => {
      if (suppressClickRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    container.addEventListener('click', handleClickCapture, true);
    return () => container.removeEventListener('click', handleClickCapture, true);
  }, [canvasContainerRef]);

  // Keyboard shortcut: Escape cancels active cable drag or quick link menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectingStateRef.current) setConnectingState(null);
        if (quickLinkMenu) setQuickLinkMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickLinkMenu]);

  // Dragging Canvas (Panning)
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedPanRef = useRef(false);
  const panStartMousePosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Marquee Selection Box (Shift + Drag)
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isMarqueeRef = useRef(false);
  const marqueeBoxRef = useRef(marqueeBox);

  useEffect(() => {
    isMarqueeRef.current = isMarqueeSelecting;
    marqueeBoxRef.current = marqueeBox;
  }, [isMarqueeSelecting, marqueeBox]);

  // Dragging a Person Card (transient 60/120 FPS drag without triggering layout recomputations)
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
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

  // Viewport culling bounding box in canvas coordinates
  const [viewportRect, setViewportRect] = useState<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateViewport = () => {
      const rect = container.getBoundingClientRect();
      setContainerDimensions({ width: rect.width, height: rect.height });
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const margin = 350 / currentZoom;
      setViewportRect({
        minX: -currentPan.x / currentZoom - margin,
        minY: -currentPan.y / currentZoom - margin,
        maxX: (rect.width - currentPan.x) / currentZoom + margin,
        maxY: (rect.height - currentPan.y) / currentZoom + margin,
      });
    };

    updateViewport();
    const ro = new ResizeObserver(updateViewport);
    ro.observe(container);
    return () => ro.disconnect();
  }, [pan.x, pan.y, zoom, canvasContainerRef]);

  // Port mouse down initiates drag-to-connect visual cable
  const handlePortMouseDown = useCallback((
    e: React.MouseEvent,
    personId: string,
    portType: PortType,
    startX: number,
    startY: number
  ) => {
    e.stopPropagation();
    const newConnecting = {
      sourcePersonId: personId,
      portType,
      startWorldX: startX,
      startWorldY: startY,
      currentWorldX: startX,
      currentWorldY: startY,
      hoveredTargetPersonId: null,
      hasMoved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    setConnectingState(newConnecting);
    connectingStateRef.current = newConnecting;
  }, []);

  // Viewport-culled visible nodes for rendering scalability
  const visibleNodes = useMemo(() => {
    const allNodes = Object.values(layout.nodes);
    // If fewer than 40 nodes, render all directly without culling overhead
    if (!viewportRect || allNodes.length < 40) {
      return allNodes;
    }
    return allNodes.filter((node) => {
      if (node.id === selectedPersonId || node.id === draggingPersonId) return true;
      const nodeRight = node.x + node.width;
      const nodeBottom = node.y + node.height;
      return (
        nodeRight >= viewportRect.minX &&
        node.x <= viewportRect.maxX &&
        nodeBottom >= viewportRect.minY &&
        node.y <= viewportRect.maxY
      );
    });
  }, [layout.nodes, viewportRect, selectedPersonId, draggingPersonId]);

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

  // Native touch & gesture handling for mobile: drag to pan and pinch to zoom
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    interface TouchState {
      mode: 'none' | 'pan' | 'pinch';
      startTouch1: TouchCoord;
      startTouch2: TouchCoord;
      startPan: { x: number; y: number };
      startZoom: number;
      startDistance: number;
      startMidpoint: { x: number; y: number };
      hasMoved: boolean;
      startedOnBackground: boolean;
    }

    const touchState: TouchState = {
      mode: 'none',
      startTouch1: { clientX: 0, clientY: 0 },
      startTouch2: { clientX: 0, clientY: 0 },
      startPan: { x: 0, y: 0 },
      startZoom: 1,
      startDistance: 0,
      startMidpoint: { x: 0, y: 0 },
      hasMoved: false,
      startedOnBackground: false,
    };

    let suppressClickTimer: ReturnType<typeof setTimeout> | null = null;
    let suppressClick = false;

    // Capture-phase click interceptor to suppress phantom clicks after dragging or pinching
    const handleClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect();
      const target = e.target as HTMLElement | null;
      const isBackground =
        target === container || Boolean(target?.classList?.contains('canvas-background'));

      if (e.touches.length === 1) {
        const t1 = e.touches[0];
        touchState.mode = 'pan';
        touchState.startTouch1 = { clientX: t1.clientX, clientY: t1.clientY };
        touchState.startPan = { ...panRef.current };
        touchState.startZoom = zoomRef.current;
        touchState.hasMoved = false;
        touchState.startedOnBackground = isBackground;
        setIsPanning(true);
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = getTouchDistance(t1, t2);
        const mid = getTouchMidpoint(t1, t2, rect);

        touchState.mode = 'pinch';
        touchState.startTouch1 = { clientX: t1.clientX, clientY: t1.clientY };
        touchState.startTouch2 = { clientX: t2.clientX, clientY: t2.clientY };
        touchState.startPan = { ...panRef.current };
        touchState.startZoom = zoomRef.current;
        touchState.startDistance = Math.max(dist, 1);
        touchState.startMidpoint = mid;
        touchState.hasMoved = false;
        touchState.startedOnBackground = isBackground;
        setIsPanning(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchState.mode === 'none') return;
      if (e.cancelable) {
        e.preventDefault();
      }

      const rect = container.getBoundingClientRect();

      if (e.touches.length === 1 && touchState.mode === 'pan') {
        const t1 = e.touches[0];
        const dx = t1.clientX - touchState.startTouch1.clientX;
        const dy = t1.clientY - touchState.startTouch1.clientY;

        if (Math.hypot(dx, dy) > 5) {
          touchState.hasMoved = true;
          suppressClick = true;
        }

        setPan({
          x: touchState.startPan.x + dx,
          y: touchState.startPan.y + dy,
        });
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = getTouchDistance(t1, t2);
        const mid = getTouchMidpoint(t1, t2, rect);

        if (touchState.mode !== 'pinch') {
          // Transition dynamically from 1-finger pan to 2-finger pinch
          touchState.mode = 'pinch';
          touchState.startTouch1 = { clientX: t1.clientX, clientY: t1.clientY };
          touchState.startTouch2 = { clientX: t2.clientX, clientY: t2.clientY };
          touchState.startPan = { ...panRef.current };
          touchState.startZoom = zoomRef.current;
          touchState.startDistance = Math.max(dist, 1);
          touchState.startMidpoint = mid;
          return;
        }

        touchState.hasMoved = true;
        suppressClick = true;

        const { zoom: newZoom, pan: newPan } = calculatePinchTransform(
          touchState.startMidpoint,
          mid,
          touchState.startPan,
          touchState.startZoom,
          touchState.startDistance,
          dist
        );

        setZoom(newZoom);
        setPan(newPan);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // One finger lifted during pinch: smoothly transition back to 1-finger pan
        const t1 = e.touches[0];
        touchState.mode = 'pan';
        touchState.startTouch1 = { clientX: t1.clientX, clientY: t1.clientY };
        touchState.startPan = { ...panRef.current };
        return;
      }

      if (e.touches.length === 0) {
        // All fingers lifted
        if (!touchState.hasMoved && touchState.startedOnBackground) {
          onSelectPerson(null);
        }

        if (touchState.hasMoved) {
          // Keep suppressing phantom clicks for next 120ms
          if (suppressClickTimer) clearTimeout(suppressClickTimer);
          suppressClickTimer = setTimeout(() => {
            suppressClick = false;
          }, 120);
        } else {
          suppressClick = false;
        }

        touchState.mode = 'none';
        touchState.hasMoved = false;
        setIsPanning(false);
      }
    };

    const handleTouchCancel = () => {
      touchState.mode = 'none';
      touchState.hasMoved = false;
      suppressClick = false;
      setIsPanning(false);
      if (suppressClickTimer) clearTimeout(suppressClickTimer);
    };

    const preventSafariGesture = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchCancel);
    container.addEventListener('click', handleClickCapture, true);
    container.addEventListener('gesturestart', preventSafariGesture);
    container.addEventListener('gesturechange', preventSafariGesture);
    container.addEventListener('gestureend', preventSafariGesture);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
      container.removeEventListener('click', handleClickCapture, true);
      container.removeEventListener('gesturestart', preventSafariGesture);
      container.removeEventListener('gesturechange', preventSafariGesture);
      container.removeEventListener('gestureend', preventSafariGesture);
      if (suppressClickTimer) clearTimeout(suppressClickTimer);
    };
  }, [canvasContainerRef, setZoom, setPan, onSelectPerson]);

  // Mouse Down on Canvas (Start Panning or Marquee Selection)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left-click starts pan or marquee
    if (quickLinkMenu) {
      setQuickLinkMenu(null);
    }

    // Only pan or marquee if clicking on empty background
    if (e.target === canvasContainerRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      if (e.shiftKey) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setIsMarqueeSelecting(true);
        setMarqueeBox({
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          currentX: e.clientX - rect.left,
          currentY: e.clientY - rect.top,
        });
      } else {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        panStartMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
        hasMovedPanRef.current = false;
      }
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
      if (connectingStateRef.current) {
        const cs = connectingStateRef.current;
        const clientDist = Math.hypot(e.clientX - cs.startClientX, e.clientY - cs.startClientY);
        const hasMoved = cs.hasMoved || clientDist > 5;
        if (hasMoved) {
          suppressClickRef.current = true;
        }

        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        const rawWorldX = (e.clientX - currentPan.x) / currentZoom;
        const rawWorldY = (e.clientY - currentPan.y) / currentZoom;

        // Detect candidate target card
        let candidateTargetId: string | null = null;
        for (const node of Object.values(layout.nodes)) {
          if (node.id === cs.sourcePersonId) continue;
          if (
            rawWorldX >= node.x - 12 &&
            rawWorldX <= node.x + node.width + 12 &&
            rawWorldY >= node.y - 12 &&
            rawWorldY <= node.y + node.height + 12
          ) {
            candidateTargetId = node.id;
            break;
          }
        }

        let snappedX = rawWorldX;
        let snappedY = rawWorldY;
        if (candidateTargetId && layout.nodes[candidateTargetId]) {
          const targetNode = layout.nodes[candidateTargetId];
          snappedX = targetNode.x + targetNode.width / 2;
          snappedY = targetNode.y + targetNode.height / 2;
        }

        const updated = {
          ...cs,
          currentWorldX: snappedX,
          currentWorldY: snappedY,
          hoveredTargetPersonId: candidateTargetId,
          hasMoved,
        };
        connectingStateRef.current = updated;
        setConnectingState(updated);
        return;
      }

      if (isMarqueeRef.current) {
        const container = canvasContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          setMarqueeBox((prev) =>
            prev ? { ...prev, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top } : null
          );
        }
      } else if (isPanning) {
        if (Math.hypot(e.clientX - panStartMousePosRef.current.clientX, e.clientY - panStartMousePosRef.current.clientY) > 4) {
          hasMovedPanRef.current = true;
        }
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

        const offset = { x: dx, y: dy };
        dragOffsetRef.current = offset;
        setDragOffset(offset);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (connectingStateRef.current) {
        const cs = connectingStateRef.current;
        const hasMoved = cs.hasMoved;
        const targetId = cs.hoveredTargetPersonId;
        const sourceId = cs.sourcePersonId;
        const port = cs.portType;
        const finalWorldX = cs.currentWorldX;
        const finalWorldY = cs.currentWorldY;

        setConnectingState(null);
        connectingStateRef.current = null;

        if (hasMoved) {
          suppressClickRef.current = true;
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 150);

          if (targetId) {
            setQuickLinkMenu({
              sourcePersonId: sourceId,
              targetPersonId: targetId,
              position: { x: e.clientX, y: e.clientY },
            });
          } else {
            const screenDist = Math.hypot(e.clientX - cs.startClientX, e.clientY - cs.startClientY);
            if (screenDist > 30 && onQuickSpawnRelative) {
              onQuickSpawnRelative(sourceId, port, {
                x: Math.round(finalWorldX - 100),
                y: Math.round(finalWorldY - 45),
              });
            }
          }
        }
        return;
      }

      if (isMarqueeRef.current) {
        const box = marqueeBoxRef.current;
        if (box && Math.hypot(box.currentX - box.startX, box.currentY - box.startY) > 6) {
          const currentZoom = zoomRef.current;
          const currentPan = panRef.current;
          const screenMinX = Math.min(box.startX, box.currentX);
          const screenMaxX = Math.max(box.startX, box.currentX);
          const screenMinY = Math.min(box.startY, box.currentY);
          const screenMaxY = Math.max(box.startY, box.currentY);

          const worldMinX = (screenMinX - currentPan.x) / currentZoom;
          const worldMaxX = (screenMaxX - currentPan.x) / currentZoom;
          const worldMinY = (screenMinY - currentPan.y) / currentZoom;
          const worldMaxY = (screenMaxY - currentPan.y) / currentZoom;

          const matchedIds: string[] = [];
          for (const node of Object.values(layout.nodes)) {
            const nodeMinX = node.x;
            const nodeMaxX = node.x + node.width;
            const nodeMinY = node.y;
            const nodeMaxY = node.y + node.height;

            const intersects =
              nodeMaxX >= worldMinX &&
              nodeMinX <= worldMaxX &&
              nodeMaxY >= worldMinY &&
              nodeMinY <= worldMaxY;

            if (intersects) {
              matchedIds.push(node.id);
            }
          }

          if (matchedIds.length > 0 && onMultiSelectPeople) {
            onMultiSelectPeople(matchedIds, true);
          }
        }
        setIsMarqueeSelecting(false);
        setMarqueeBox(null);
      }

      if (isPanning) {
        if (!hasMovedPanRef.current) {
          onSelectPerson(null);
        }
        setIsPanning(false);
      }
      if (draggingPersonId) {
        if (hasMovedCardRef.current) {
          const finalOffset = dragOffsetRef.current || { x: 0, y: 0 };
          const finalX = dragStartRef.current.nodeX + finalOffset.x;
          const finalY = dragStartRef.current.nodeY + finalOffset.y;
          onUpdatePersonPosition(draggingPersonId, finalX, finalY);
          if (onFinishDragPerson) {
            onFinishDragPerson(draggingPersonId);
          }
        }
        setDraggingPersonId(null);
        setDragOffset(null);
        dragOffsetRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, draggingPersonId, zoom, setPan, onUpdatePersonPosition, onFinishDragPerson, layout.nodes, onMultiSelectPeople, canvasContainerRef, onSelectPerson, onQuickSpawnRelative]);

  return (
    <div
      ref={canvasContainerRef}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onCanvasContextMenu?.(e);
      }}
      className={`relative w-full h-full overflow-hidden bg-slate-50 canvas-background touch-none select-none overscroll-none ${
        isPanning ? 'cursor-grabbing' : isMarqueeSelecting ? 'cursor-crosshair' : 'cursor-grab'
      }`}
    >
      {/* Visual Marquee Box */}
      {isMarqueeSelecting && marqueeBox && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
            top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
            width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
            height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
            pointerEvents: 'none',
            zIndex: 60,
          }}
          className="border-2 border-indigo-500 bg-indigo-500/15 rounded-lg shadow-xs"
        />
      )}
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

        {/* Dynamic Drag-to-Connect Visual Cable */}
        {connectingState && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 45,
            }}
          >
            <ConnectionCable
              startX={connectingState.startWorldX}
              startY={connectingState.startWorldY}
              currentX={connectingState.currentWorldX}
              currentY={connectingState.currentWorldY}
              portType={connectingState.portType}
              hoveredTargetName={
                connectingState.hoveredTargetPersonId && tree.people[connectingState.hoveredTargetPersonId]
                  ? getPersonDisplayName(tree.people[connectingState.hoveredTargetPersonId])
                  : null
              }
            />
          </svg>
        )}

        {/* HTML Interactive Person Cards (Culled to visible viewport) */}
        {visibleNodes.map((node: LayoutNode) => {
          const person = node.data;
          const hasDescendants = (person.unionIds || []).some(
            (uId) => (tree.unions[uId]?.childrenIds?.length || 0) > 0
          );

          const isRoomHonoree = Boolean(
            activeMoment &&
              ((activeMoment.personId && activeMoment.personId === node.id) ||
                (activeMoment.unionId && tree.unions[activeMoment.unionId]?.partnerIds.includes(node.id)))
          );

          return (
            <PersonCard
              key={node.id}
              node={node}
              dragOffset={draggingPersonId === node.id ? dragOffset : null}
              layoutStyle={layoutStyle}
              isSelected={selectedPersonId === node.id}
              isMultiSelected={selectedPersonIds ? selectedPersonIds.has(node.id) : false}
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
                if (!hasMovedCardRef.current && !suppressClickRef.current) {
                  onSelectPerson(id, e);
                }
              }}
              onContextMenu={onPersonContextMenu}
              onHover={(id) => {
                if (!connectingStateRef.current) {
                  setHoveredPersonId(id);
                }
              }}
              onAddChild={onAddChild}
              onAddPartner={onAddPartner}
              onAddSibling={onAddSibling}
              onAddParent={onAddParent}
              onDragStart={handleCardDragStart}
              onPortMouseDown={handlePortMouseDown}
              isConnectTarget={connectingState?.hoveredTargetPersonId === node.id}
            />
          );
        })}
      </div>

      {/* Floating QuickLink Menu HUD */}
      {quickLinkMenu && (
        <QuickLinkMenu
          tree={tree}
          sourcePersonId={quickLinkMenu.sourcePersonId}
          targetPersonId={quickLinkMenu.targetPersonId}
          position={quickLinkMenu.position}
          onLink={(type) => {
            onQuickLink?.(quickLinkMenu.sourcePersonId, quickLinkMenu.targetPersonId, type);
            setQuickLinkMenu(null);
          }}
          onClose={() => setQuickLinkMenu(null)}
        />
      )}

      {/* MiniMap Radar Navigator HUD */}
      {isMiniMapOpen && (
        <div className="absolute bottom-5 left-5 z-20 pointer-events-auto">
          <MiniMap
            layout={layout}
            pan={pan}
            zoom={zoom}
            containerWidth={containerDimensions.width}
            containerHeight={containerDimensions.height}
            onPanChange={setPan}
            isOpen={isMiniMapOpen}
            onToggleOpen={onToggleMiniMap}
          />
        </div>
      )}
    </div>
  );
};
