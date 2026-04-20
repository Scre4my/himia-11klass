import React from 'react';
import { StageResult } from '../types/Evaporator';
import './InputField.css';

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (value: any) => void;
  type?: 'number' | 'text' | 'select';
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  error?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  type = 'number',
  options,
  min,
  max,
  step,
  unit,
  error
}) => {
  return (
    <div className={`input-field ${error ? 'has-error' : ''}`}>
      <label className="input-field-label">
        {label}
        {unit && <span className="input-unit">{unit}</span>}
      </label>
      
      {type === 'select' && options ? (
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="input-field-select"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => {
            if (type === 'number') {
              onChange(parseFloat(e.target.value));
            } else {
              onChange(e.target.value);
            }
          }}
          min={min}
          max={max}
          step={step}
          className="input-field-input"
        />
      )}
      
      {error && <span className="input-error">{error}</span>}
    </div>
  );
};

export default InputField;
