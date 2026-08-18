import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MultiSelectDropdown.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedButton && !clickedPanel) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((o) => o !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const buttonLabel = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`multi-select-button ${selected.length > 0 ? "active" : ""}`}
        onClick={handleToggle}
      >
        {buttonLabel} <span className="multi-select-caret">▾</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="multi-select-panel"
            style={{ top: position.top, left: position.left }}
          >
            <div className="multi-select-actions">
              <button type="button" onClick={() => onChange(options.map((o) => o.value))}>
                Select all
              </button>
              <button type="button" onClick={() => onChange([])}>
                Clear
              </button>
            </div>
            <div className="multi-select-options">
              {options.map((option) => (
                <label key={option.value} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggleOption(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
