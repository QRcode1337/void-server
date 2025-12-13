import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { ICON_DEFINITIONS, ICON_CATEGORIES, DEFAULT_ICON } from '../config/icons';

// Convert kebab-case to PascalCase for lucide-react imports
const kebabToPascal = (str) => {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

// Get icon component from lucide-react
const getIconComponent = (iconName) => {
  const pascalName = kebabToPascal(iconName);
  return LucideIcons[pascalName] || LucideIcons.Box;
};

/**
 * IconPicker - Searchable autocomplete icon picker with preview
 */
export default function IconPicker({ value, onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search.trim()) {
      return ICON_DEFINITIONS;
    }
    const searchLower = search.toLowerCase();
    return ICON_DEFINITIONS.filter(icon =>
      icon.label.toLowerCase().includes(searchLower) ||
      icon.value.toLowerCase().includes(searchLower) ||
      icon.category.toLowerCase().includes(searchLower)
    );
  }, [search]);

  // Group filtered icons by category
  const groupedIcons = useMemo(() => {
    const groups = {};
    filteredIcons.forEach(icon => {
      if (!groups[icon.category]) {
        groups[icon.category] = [];
      }
      groups[icon.category].push(icon);
    });
    return groups;
  }, [filteredIcons]);

  // Get current icon info
  const currentIcon = ICON_DEFINITIONS.find(i => i.value === value) || {
    value: value || DEFAULT_ICON,
    label: value || DEFAULT_ICON,
    category: 'general'
  };

  const CurrentIconComponent = getIconComponent(currentIcon.value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-icon-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          Math.min(prev + 1, filteredIcons.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredIcons[highlightedIndex]) {
          selectIcon(filteredIcons[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

  const selectIcon = (iconValue) => {
    onChange(iconValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  // Flatten icons with category headers for keyboard navigation
  let flatIndex = 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Icon Display / Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:border-[var(--color-primary)] transition-colors"
      >
        <div className="w-8 h-8 rounded bg-[var(--color-surface)] flex items-center justify-center">
          <CurrentIconComponent className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-medium">{currentIcon.label}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {ICON_CATEGORIES[currentIcon.category] || currentIcon.category}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search icons..."
                className="w-full pl-9 pr-8 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Icon List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {filteredIcons.length === 0 ? (
              <div className="p-4 text-center text-[var(--color-text-secondary)] text-sm">
                No icons found for "{search}"
              </div>
            ) : (
              Object.entries(groupedIcons).map(([category, icons]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] bg-[var(--color-background)] sticky top-0">
                    {ICON_CATEGORIES[category] || category}
                  </div>
                  {/* Icons Grid */}
                  <div className="grid grid-cols-4 gap-1 p-2">
                    {icons.map((icon) => {
                      const IconComponent = getIconComponent(icon.value);
                      const itemIndex = flatIndex++;
                      const isHighlighted = itemIndex === highlightedIndex;
                      const isSelected = icon.value === value;

                      return (
                        <button
                          key={icon.value}
                          data-icon-item
                          onClick={() => selectIcon(icon.value)}
                          onMouseEnter={() => setHighlightedIndex(itemIndex)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                              : isHighlighted
                              ? 'bg-[var(--color-border)]'
                              : 'hover:bg-[var(--color-border)]'
                          }`}
                          title={icon.label}
                        >
                          <IconComponent className="w-5 h-5" />
                          <span className="text-[10px] truncate w-full text-center">
                            {icon.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with count */}
          <div className="px-3 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
            {filteredIcons.length} icon{filteredIcons.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}
    </div>
  );
}
