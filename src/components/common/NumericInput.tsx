import React, { forwardRef } from 'react';

/**
 * Normalizes user numeric input:
 * 1. Converts Bengali digits (০-৯) and fullwidth/Arabic digits to ASCII (0-9)
 * 2. Normalizes comma decimal separator to dot (.)
 * 3. Removes formatting commas (e.g. 10,000 -> 10000)
 * 4. Filters out any alphabets, symbols, or invalid characters
 * 5. Ensures at most one decimal point
 */
export function normalizeNumericString(
  raw: string,
  allowDecimal = true,
  allowNegative = false
): string {
  if (!raw) return '';

  // 1. Convert Bengali numerals (০-৯) to ASCII (0-9)
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let val = String(raw);
  for (let i = 0; i < 10; i++) {
    val = val.replaceAll(bengaliDigits[i], i.toString());
  }

  // 2. Convert full-width digits (０-９)
  val = val.replace(/[\uFF10-\uFF19]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));

  // 3. Convert Arabic-Indic digits (٠-٩)
  val = val.replace(/[\u0660-\u0669]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x0660 + 48));

  // 4. Handle thousands separators (commas) vs decimal point
  if (val.includes(',') && val.includes('.')) {
    val = val.replace(/,/g, '');
  } else if (val.includes(',')) {
    if (/,\d{3}($|,)/.test(val)) {
      val = val.replace(/,/g, '');
    } else if (allowDecimal) {
      val = val.replace(',', '.');
    }
  }

  // 5. Sanitize characters: keep digits, single dot, optional leading minus
  let result = '';
  let hasDot = false;
  let hasMinus = false;

  for (let i = 0; i < val.length; i++) {
    const ch = val[i];
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (allowDecimal && ch === '.' && !hasDot) {
      result += '.';
      hasDot = true;
    } else if (allowNegative && ch === '-' && !hasMinus && result.length === 0) {
      result += '-';
      hasMinus = true;
    }
  }

  return result;
}

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(({
  value,
  onChange,
  allowDecimal = true,
  allowNegative = false,
  className = '',
  placeholder = '0.00',
  ...rest
}, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow keyboard shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z, Cmd+...)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // Allow navigation, editing and tab/enter keys, as well as Android/IME virtual keys
    const allowedSpecialKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Enter',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Unidentified',
      'Process',
      'Dead',
    ];
    if (allowedSpecialKeys.includes(e.key)) {
      return;
    }

    // Check if key is a digit (ASCII 0-9 or Bengali ০-৯)
    const isAsciiDigit = e.key >= '0' && e.key <= '9';
    const isBengaliDigit = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'].includes(e.key);
    const isDigit = isAsciiDigit || isBengaliDigit;

    const input = e.currentTarget;
    const hasSelection = (input.selectionStart ?? 0) !== (input.selectionEnd ?? 0);
    const currentValStr = String(value ?? '');
    const alreadyHasDot = currentValStr.includes('.');
    const isDecimal = allowDecimal && (e.key === '.' || e.key === ',') && (!alreadyHasDot || hasSelection);
    const isMinus = allowNegative && e.key === '-' && (!currentValStr.includes('-') || hasSelection);

    if (!isDigit && !isDecimal && !isMinus) {
      // Strictly prevent alphabets and special symbols from typing into numeric field
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = normalizeNumericString(raw, allowDecimal, allowNegative);

    // Create synthetic event with sanitized numeric string
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: clean,
        name: e.target.name,
      },
      currentTarget: {
        ...e.currentTarget,
        value: clean,
        name: e.currentTarget.name,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    onChange(syntheticEvent);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleanPasted = normalizeNumericString(pastedText, allowDecimal, allowNegative);
    if (!cleanPasted && cleanPasted !== '') return;

    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentValStr = String(value ?? '');
    const newVal = currentValStr.slice(0, start) + cleanPasted + currentValStr.slice(end);
    const finalClean = normalizeNumericString(newVal, allowDecimal, allowNegative);

    const syntheticEvent = {
      target: { ...input, value: finalClean, name: input.name },
      currentTarget: { ...input, value: finalClean, name: input.name },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onChange(syntheticEvent);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={value ?? ''}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onPaste={handlePaste}
      className={className}
    />
  );
});

NumericInput.displayName = 'NumericInput';
