'use client';

import { Children, isValidElement, useId, type ReactNode } from 'react';
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select';

type FilterSelectProps = {
  id?: string;
  label?: string;
  'aria-label'?: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
};

function optionText(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? optionText(child.props.children) : String(child)).join('');
}

// Keep the existing option lists and their values: searching only narrows the
// dropdown; it never applies a filter until an option is explicitly chosen.
export function filterOptions(children: ReactNode): SearchableSelectOption[] {
  const options: SearchableSelectOption[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) return;
    if (child.type === 'option') {
      const label = optionText(child.props.children);
      options.push({ value: child.props.value ?? label, label });
    } else {
      options.push(...filterOptions(child.props.children));
    }
  });
  return options;
}

export function FilterSelect({ id, label, 'aria-label': ariaLabel, value, onChange,
  children, className, disabled, required }: FilterSelectProps) {
  const generatedId = useId();
  const accessibleLabel = ariaLabel || label || 'Bộ lọc';
  return <SearchableSelect
    id={id || `filter-${generatedId.replace(/:/g, '')}`}
    label={accessibleLabel}
    value={value}
    onChange={onChange}
    options={filterOptions(children)}
    disabled={disabled}
    required={required}
    className={className}
    wrapperClassName="contents"
    searchPlaceholder="Nhập để tìm trong danh sách..."
  />;
}
