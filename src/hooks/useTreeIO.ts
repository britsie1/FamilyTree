import { useCallback, type RefObject } from 'react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import type { TreeData, TreeLayout } from '../types/tree';
import {
  saveCurrentTree,
  exportTreeToJsonFile,
  importTreeFromJsonString,
  sanitizeFilename,
  createDoubleInLawPreset,
  createDivorceBlendedPreset,
  createThreeGenSampleTree,
  createBlankTree,
} from '../services/storage';
import { parseGedcom, exportGedcomToFile } from '../services/gedcomService';
import { exportTreeAsSvg, exportTreeAsFullImage } from '../services/treeExportService';
import { useTreeStore } from '../stores/useTreeStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useCollabStore } from '../stores/useCollabStore';
import { useThemeStore } from '../stores/useThemeStore';
import { createSnapshot } from '../services/snapshotService';

export interface UseTreeIOOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  layout?: TreeLayout;
  onSwitchTree: (tree: TreeData, isCloud?: boolean) => void;
  onClearUrl: () => void;
}

export function useTreeIO({ containerRef, layout, onSwitchTree, onClearUrl }: UseTreeIOOptions) {
  const tree = useTreeStore((s) => s.tree);
  const addPerson = useTreeStore((s) => s.addPerson);
  const makeCopyAction = useTreeStore((s) => s.makeCopy);

  const selectPerson = useCanvasStore((s) => s.selectPerson);

  const setIsCloudTree = useCollabStore((s) => s.setIsCloudTree);
  const setUserPermission = useCollabStore((s) => s.setUserPermission);
  const setAccessDeniedMessage = useCollabStore((s) => s.setAccessDeniedMessage);
  const isReadOnly = useCollabStore((s) => s.userPermission === 'viewer');

  const isDark = useThemeStore((s) => s.isDark);

  const handleMakeCopy = useCallback(() => {
    makeCopyAction();
    setIsCloudTree(false);
    setUserPermission('owner');
    setAccessDeniedMessage(null);
    onClearUrl();
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [makeCopyAction, setIsCloudTree, setUserPermission, setAccessDeniedMessage, onClearUrl]);

  const handleSelectPreset = useCallback((presetKey: 'double_in_law' | 'divorce' | 'royal' | 'blank') => {
    // Capture snapshot of current tree before switching presets if it contains data
    if (tree && Object.keys(tree.people || {}).length > 0) {
      createSnapshot(
        tree,
        presetKey === 'blank' ? 'pre-tree-clear' : 'pre-preset-switch',
        `Automatic backup before switching to ${presetKey} template`
      ).catch(console.warn);
    }

    let nextTree: TreeData;
    if (presetKey === 'double_in_law') nextTree = createDoubleInLawPreset();
    else if (presetKey === 'divorce') nextTree = createDivorceBlendedPreset();
    else if (presetKey === 'royal') nextTree = createThreeGenSampleTree();
    else nextTree = createBlankTree();

    nextTree.id = `tree_${presetKey}_${Date.now().toString(36)}`;
    saveCurrentTree(nextTree);
    onSwitchTree(nextTree, false);
  }, [tree, onSwitchTree]);

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const isGed = file.name.toLowerCase().endsWith('.ged');

        // Capture snapshot before applying imported tree
        if (tree && Object.keys(tree.people || {}).length > 0) {
          createSnapshot(
            tree,
            isGed ? 'pre-gedcom-import' : 'pre-json-import',
            `Automatic backup before importing ${file.name}`
          ).catch(console.warn);
        }

        const imported = isGed
          ? parseGedcom(content, file.name.replace(/\.[^/.]+$/, ''))
          : importTreeFromJsonString(content);

        saveCurrentTree(imported);
        onSwitchTree(imported, false);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (err: any) {
        alert(`Error importing tree file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }, [tree, onSwitchTree]);

  const handleExportImage = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      const dataUrl = await toPng(container, {
        quality: 0.95,
        backgroundColor: isDark ? '#020617' : '#f8fafc',
      });
      const a = document.createElement('a');
      a.download = `${sanitizeFilename(tree.name)}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    } catch {
      alert('Could not export tree image. Try zooming out and retrying.');
    }
  }, [containerRef, isDark, tree.name]);

  const handleExportSvg = useCallback(() => {
    if (!layout) return;
    try {
      exportTreeAsSvg(tree, layout, isDark);
    } catch (err: any) {
      alert(`Error exporting SVG: ${err.message}`);
    }
  }, [tree, layout, isDark]);

  const handleExportFullImage = useCallback(async () => {
    if (!layout) {
      return handleExportImage();
    }
    try {
      await exportTreeAsFullImage(tree, layout, isDark);
    } catch {
      // Fallback to screen capture
      await handleExportImage();
    }
  }, [tree, layout, isDark, handleExportImage]);

  const handleExportJson = useCallback(() => {
    exportTreeToJsonFile(tree);
  }, [tree]);

  const handleExportGedcom = useCallback(() => {
    exportGedcomToFile(tree);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  }, [tree]);

  const handleAddPerson = useCallback(() => {
    if (isReadOnly) return;
    const p = addPerson({ firstName: '', lastName: '' });
    selectPerson(p.id);
  }, [isReadOnly, addPerson, selectPerson]);

  return {
    handleMakeCopy,
    handleSelectPreset,
    handleImportFile,
    handleExportImage,
    handleExportFullImage,
    handleExportSvg,
    handleExportJson,
    handleExportGedcom,
    handleAddPerson,
  };
}
