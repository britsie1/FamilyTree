import type { PersonCardProps } from './PersonCard';

/**
 * Custom comparison function for memoizing PersonCard.
 * Returns true if props are equal (skipping render), false if card needs to re-render.
 */
export function arePersonCardPropsEqual(
  prev: PersonCardProps,
  next: PersonCardProps
): boolean {
  if (
    prev.isSelected !== next.isSelected ||
    prev.isMultiSelected !== next.isMultiSelected ||
    prev.isCompared !== next.isCompared ||
    prev.isOnRelationshipPath !== next.isOnRelationshipPath ||
    prev.hasActiveComparison !== next.hasActiveComparison ||
    prev.isHovered !== next.isHovered ||
    prev.hasDescendants !== next.hasDescendants ||
    prev.temporalYear !== next.temporalYear ||
    prev.isRoomHonoree !== next.isRoomHonoree ||
    prev.isConnectTarget !== next.isConnectTarget ||
    prev.layoutStyle !== next.layoutStyle ||
    prev.isBeaconActive !== next.isBeaconActive ||
    prev.isSearchMatch !== next.isSearchMatch ||
    prev.isSearchDimmed !== next.isSearchDimmed
  ) {
    return false;
  }

  // Check dragOffset coordinates
  if (prev.dragOffset !== next.dragOffset) {
    if (!prev.dragOffset || !next.dragOffset) return false;
    if (
      prev.dragOffset.x !== next.dragOffset.x ||
      prev.dragOffset.y !== next.dragOffset.y
    ) {
      return false;
    }
  }

  // Check activeMoment
  if (prev.activeMoment !== next.activeMoment) {
    if (prev.activeMoment?.id !== next.activeMoment?.id) return false;
  }

  // Check node
  if (prev.node !== next.node) {
    if (
      prev.node.id !== next.node.id ||
      prev.node.x !== next.node.x ||
      prev.node.y !== next.node.y ||
      prev.node.width !== next.node.width ||
      prev.node.height !== next.node.height ||
      prev.node.isCollapsed !== next.node.isCollapsed ||
      prev.node.hiddenCount !== next.node.hiddenCount ||
      prev.node.data !== next.node.data ||
      prev.node.displayInfo !== next.node.displayInfo
    ) {
      return false;
    }
  }

  // Check callbacks
  if (
    prev.onSelect !== next.onSelect ||
    prev.onHover !== next.onHover ||
    prev.onDragStart !== next.onDragStart ||
    prev.onPortMouseDown !== next.onPortMouseDown ||
    prev.onContextMenu !== next.onContextMenu ||
    prev.onAddChild !== next.onAddChild ||
    prev.onAddPartner !== next.onAddPartner ||
    prev.onAddSibling !== next.onAddSibling ||
    prev.onAddParent !== next.onAddParent ||
    prev.onToggleCollapse !== next.onToggleCollapse ||
    prev.onOpenTreeLink !== next.onOpenTreeLink ||
    prev.onPreviewDocument !== next.onPreviewDocument
  ) {
    return false;
  }

  return true;
}
