/**
 * components/master-data/types.ts
 *
 * Shared type contracts for the reusable Master Data CRUD framework
 * (WP-ADMIN-02A — Skills is the reference implementation).
 *
 * Every future module (Roles, Career Domains, Skill Clusters) configures
 * these generics with its own record shape instead of writing a new table,
 * form, or toolbar from scratch.
 */

import type { ReactNode } from 'react';

/** A single column definition for MasterDataTable. */
export interface MasterDataColumn<T> {
  /** Stable key — also used as the React key for the column/cell. */
  key: string;
  /** Column header label. */
  header: string;
  /** Render the cell's contents for a given row. */
  render: (row: T) => ReactNode;
  /** Optional column width hint (Tailwind class, e.g. 'w-40'). */
  widthClassName?: string;
  /** Right-align numeric/status columns. */
  align?: 'left' | 'right' | 'center';
}

/** A row-level action (e.g. "Edit", "Archive") rendered in the actions column. */
export interface MasterDataRowAction<T> {
  key: string;
  label: string;
  onClick: (row: T) => void;
  /** Visually distinguish destructive actions. */
  variant?: 'default' | 'destructive';
  /** Hide the action for a given row (e.g. already archived). */
  hidden?: (row: T) => boolean;
}

/** Field types supported by MasterDataForm's generic field renderer. */
export type MasterDataFieldType = 'text' | 'textarea' | 'select' | 'tags' | 'number';

/** A single form field definition, driving both layout and validation display. */
export interface MasterDataFieldConfig<TValues> {
  name: keyof TValues & string;
  label: string;
  type: MasterDataFieldType;
  placeholder?: string;
  required?: boolean;
  /** For type: 'select'. */
  options?: { value: string; label: string }[];
  /** For type: 'tags' / 'text' — max length shown as a hint + enforced on input. */
  maxLength?: number;
  /** For type: 'number'. */
  min?: number;
  max?: number;
  helpText?: string;
}

/** Field-level validation errors, keyed by field name — shape backend `details` maps into. */
export type MasterDataFieldErrors = Record<string, string>;
