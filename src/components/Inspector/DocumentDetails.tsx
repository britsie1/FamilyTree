import React from 'react';
import type { PersonDocument } from '../../types/tree';

const documentDetailFields = [
  { key: 'description', label: 'Description / notes', placeholder: 'Short summary or research notes' },
  { key: 'documentType', label: 'Document type', placeholder: 'Birth certificate, census, letter…' },
  { key: 'documentDate', label: 'Document date', placeholder: 'e.g. 12 March 1890, 1890, or circa 1890' },
  { key: 'documentPlace', label: 'Place', placeholder: 'Town, parish, district or country' },
  { key: 'sourceReference', label: 'Source / reference', placeholder: 'Archive, register, page or reference number' },
  { key: 'transcription', label: 'Transcription / typed details', placeholder: 'Type the handwritten text here. Use [illegible] or [?] for uncertain words.' },
] as const;

export type DocumentDetailsValues = Partial<Pick<PersonDocument, typeof documentDetailFields[number]['key']>>;

export const DocumentDetailsForm: React.FC<{
  value: DocumentDetailsValues;
  onChange: (value: DocumentDetailsValues) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="space-y-2">
    <p className="text-xs text-slate-500 dark:text-slate-400">All details are optional and saved with this attachment in the family tree.</p>
    {documentDetailFields.map(({ key, label, placeholder }) => (
      <label key={key} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
        {key === 'transcription' || key === 'description' ? (
          <textarea
            aria-label={label}
            value={value[key] || ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            disabled={disabled}
            rows={key === 'transcription' ? 8 : 2}
            placeholder={placeholder}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-y"
          />
        ) : (
          <input
            aria-label={label}
            type="text"
            value={value[key] || ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            disabled={disabled}
            placeholder={placeholder}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        )}
      </label>
    ))}
  </div>
);

export const DocumentDetails: React.FC<{ document: PersonDocument }> = ({ document }) => (
  <dl className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
    {documentDetailFields.map(({ key, label }) => document[key] ? (
      <div key={key}>
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words">{document[key]}</dd>
      </div>
    ) : null)}
    {!documentDetailFields.some(({ key }) => document[key]) && (
      <div className="text-xs text-slate-500">No typed details added yet.</div>
    )}
  </dl>
);