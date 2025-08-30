import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const Input: React.FC<InputProps> = ({ label, id, className = '', ...props }) => {
    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
    return (
        <div>
            {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>}
            <input
                id={inputId}
                className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:opacity-50 ${className}`}
                {...props}
            />
        </div>
    );
};

export default Input;