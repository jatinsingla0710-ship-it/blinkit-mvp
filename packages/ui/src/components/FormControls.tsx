import type { InputHTMLAttributes, ReactNode } from 'react';
import './FormControls.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  grow?: boolean;
  hint?: string;
  className?: string;
};

export function TextField({
  label,
  grow,
  hint,
  className,
  id,
  ...rest
}: Props) {
  const inputId = id ?? rest.name;
  return (
    <label
      className={[
        'ga-field',
        grow ? 'ga-field--grow' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ga-field__label">{label}</span>
      <input id={inputId} className="ga-field__control" {...rest} />
      {hint ? <span className="ga-field__hint">{hint}</span> : null}
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  grow?: boolean;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
};

export function SelectField({
  label,
  value,
  onChange,
  children,
  grow,
  className,
  id,
  name,
  disabled,
}: SelectProps) {
  return (
    <label
      className={[
        'ga-field',
        grow ? 'ga-field--grow' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ga-field__label">{label}</span>
      <select
        id={id ?? name}
        name={name}
        className="ga-field__control"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
