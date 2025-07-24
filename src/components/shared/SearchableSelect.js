// src/components/shared/SearchableSelect.js
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import "./SearchableSelect.css";

const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  name,
  error,
  disabled = false,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Get the display value for the selected option
  const selectedOption = options.find((opt) => opt.id === value);
  const displayValue = selectedOption?.value || "";

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsListRef.current) {
      const highlightedElement = optionsListRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex]);

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
    setIsFocused(false);
  };

  const handleInputClick = () => {
    if (!disabled && !isOpen) {
      setIsOpen(true);
      setSearchTerm("");
      inputRef.current?.select();
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (!isOpen) {
      setIsOpen(true);
      setSearchTerm("");
    }
  };

  const handleInputBlur = () => {
    // Use setTimeout to allow click events on options to fire first
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        handleClose();
      }
    }, 200);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleSelect = (option) => {
    onChange({
      target: {
        name: name,
        value: option.id,
      },
    });
    handleClose();
    inputRef.current?.blur();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({
      target: {
        name: name,
        value: "",
      },
    });
    setSearchTerm("");
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        inputRef.current?.blur();
        break;
      case "Tab":
        // Allow tab to work normally, just close dropdown
        handleClose();
        break;
      default:
        break;
    }
  };

  // Determine what to show in the input
  const inputValue = isFocused || isOpen ? searchTerm : displayValue;

  return (
    <div
      ref={dropdownRef}
      className={`searchable-select ${error ? "is-invalid" : ""} ${
        disabled ? "disabled" : ""
      }`}
    >
      <div className="searchable-select__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`searchable-select__input form-control ${
            error ? "is-invalid" : ""
          }`}
          value={inputValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-required={required}
          autoComplete="off"
        />
        
        {value && !disabled && (
          <button
            type="button"
            className="searchable-select__clear"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        )}
        
        <ChevronDown
          size={16}
          className={`searchable-select__arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="searchable-select__dropdown" role="listbox">
          <div ref={optionsListRef} className="searchable-select__options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select__no-results">
                No matching schools found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  className={`searchable-select__option ${
                    option.id === value ? "selected" : ""
                  } ${index === highlightedIndex ? "highlighted" : ""}`}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={option.id === value}
                >
                  {option.value}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;