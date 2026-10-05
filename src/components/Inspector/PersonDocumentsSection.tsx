import React from 'react';
import { EntityDocumentsSection } from './EntityDocumentsSection';
import type { Person, PersonDocument, TreeData } from '../../types/tree';
import { getPersonDisplayName } from '../../services/treeOperations';
import { useTreeStore } from '../../stores/useTreeStore';
import { useCollabStore } from '../../stores/useCollabStore';

export interface PersonDocumentsSectionProps {
  person: Person;
  tree?: TreeData;
  isReadOnly?: boolean;
  onUpdatePerson?: (personId: string, updates: Partial<Person>) => void;
  onOpenShareModal?: () => void;
  onPreviewDocument?: (doc: PersonDocument, personName: string) => void;
}

export const PersonDocumentsSection: React.FC<PersonDocumentsSectionProps> = (props) => {
  const storeTree = useTreeStore((s) => s.tree);
  const storeUpdatePerson = useTreeStore((s) => s.updatePerson);
  const storeIsShareModalOpen = useCollabStore((s) => s.setIsShareModalOpen);
  const storeUserPermission = useCollabStore((s) => s.userPermission);

  const tree = props.tree || storeTree;
  const isReadOnly = props.isReadOnly !== undefined ? props.isReadOnly : storeUserPermission === 'viewer';
  const handleUpdate = props.onUpdatePerson || storeUpdatePerson;
  const handleOpenShareModal = props.onOpenShareModal || (() => storeIsShareModalOpen(true));
  const displayName = getPersonDisplayName(props.person);

  return (
    <EntityDocumentsSection
      key={props.person.id}
      entityId={props.person.id}
      entityName={displayName}
      documents={props.person.documents}
      tree={tree}
      isReadOnly={isReadOnly}
      onUpdateDocuments={(docs) => handleUpdate(props.person.id, { documents: docs })}
      onOpenShareModal={handleOpenShareModal}
      onPreviewDocument={props.onPreviewDocument}
    />
  );
};
