import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { QuickLinkType } from '../components/Canvas/QuickLinkMenu';
import type { PortType } from '../components/Canvas/ConnectionCable';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useCollabStore } from '../stores/useCollabStore';

export function useQuickConnect() {
  const isReadOnly = useCollabStore((s) => s.userPermission === 'viewer');
  const layoutStyle = useCanvasStore((s) => s.layoutStyle);
  const selectPerson = useCanvasStore((s) => s.selectPerson);

  const linkChild = useTreeStore((s) => s.linkChild);
  const linkParent = useTreeStore((s) => s.linkParent);
  const linkPartner = useTreeStore((s) => s.linkPartner);
  const linkSibling = useTreeStore((s) => s.linkSibling);

  const addChild = useTreeStore((s) => s.addChild);
  const addParent = useTreeStore((s) => s.addParent);
  const addPartner = useTreeStore((s) => s.addPartner);
  const addSibling = useTreeStore((s) => s.addSibling);
  const updatePersonPosition = useTreeStore((s) => s.updatePersonPosition);

  const handleQuickLink = useCallback(
    (sourcePersonId: string, targetPersonId: string, type: QuickLinkType) => {
      if (isReadOnly || sourcePersonId === targetPersonId) return;

      if (type === 'child') linkChild(sourcePersonId, targetPersonId);
      else if (type === 'parent') linkParent(sourcePersonId, targetPersonId);
      else if (type === 'partner') linkPartner(sourcePersonId, targetPersonId);
      else if (type === 'sibling') linkSibling(sourcePersonId, targetPersonId);

      confetti({ particleCount: 35, spread: 55, origin: { y: 0.65 } });
    },
    [isReadOnly, linkChild, linkParent, linkPartner, linkSibling]
  );

  const handleQuickSpawnRelative = useCallback(
    (
      sourcePersonId: string,
      portType: PortType,
      worldPosition: { x: number; y: number }
    ) => {
      if (isReadOnly) return;

      let newId = '';
      if (portType === 'child') newId = addChild(sourcePersonId);
      else if (portType === 'parent') newId = addParent(sourcePersonId);
      else if (portType === 'partner') newId = addPartner(sourcePersonId);
      else if (portType === 'sibling') newId = addSibling(sourcePersonId);

      if (newId) {
        updatePersonPosition(newId, worldPosition.x, worldPosition.y, layoutStyle);
        selectPerson(newId);
        confetti({ particleCount: 30, spread: 45, origin: { y: 0.65 } });
      }
    },
    [isReadOnly, addChild, addParent, addPartner, addSibling, updatePersonPosition, layoutStyle, selectPerson]
  );

  return {
    handleQuickLink,
    handleQuickSpawnRelative,
  };
}
