import React, { useState } from 'react';
import { Plus, Edit2, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  color?: string;
}

interface EditableSelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  onAddNew?: (newName: string) => Promise<string | void> | string | void;
  onEditSelected?: (selectedValue: string, updatedName: string) => Promise<void> | void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  addNewTitle?: string;
  editTitle?: string;
}

export const EditableSelect: React.FC<EditableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  onAddNew,
  onEditSelected,
  placeholder = 'Select an option',
  required = false,
  className = '',
  addNewTitle = 'Add New',
  editTitle = 'Edit Selected',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [editingName, setEditingName] = useState('');

  const selectedOption = options.find((o) => o.value === value);

  const handleStartEdit = () => {
    if (!selectedOption) return;
    setEditingName(selectedOption.label);
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleConfirmEdit = async () => {
    if (!editingName.trim() || !onEditSelected || !value) return;
    await onEditSelected(value, editingName.trim());
    setIsEditing(false);
  };

  const handleConfirmAdd = async () => {
    if (!newItemName.trim() || !onAddNew) return;
    const newId = await onAddNew(newItemName.trim());
    if (newId && typeof newId === 'string') {
      onChange(newId);
    }
    setNewItemName('');
    setIsAdding(false);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            {onEditSelected && value && (
              <button
                type="button"
                onClick={handleStartEdit}
                title={editTitle}
                className="text-2xs font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 flex items-center gap-0.5 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
            {onAddNew && (
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  setIsEditing(false);
                }}
                title={addNewTitle}
                className="text-2xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>+ New</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode: Adding New Inline */}
      {isAdding && (
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <div className="flex items-center justify-between text-2xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>Create New Option</span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              placeholder="Enter name..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmAdd();
                } else if (e.key === 'Escape') {
                  setIsAdding(false);
                }
              }}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={!newItemName.trim()}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode: Editing Current Selected Inline */}
      {isEditing && (
        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
          <div className="flex items-center justify-between text-2xs font-semibold text-blue-800 dark:text-blue-300">
            <span>Rename Selected Option</span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleConfirmEdit}
              disabled={!editingName.trim()}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Select Field */}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} {opt.subLabel ? `(${opt.subLabel})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
