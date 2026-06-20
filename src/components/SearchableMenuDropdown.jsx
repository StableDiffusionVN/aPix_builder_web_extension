import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export function SearchableMenuDropdown({
  value,
  options,
  onChange,
  placeholder = "Chọn model…",
  searchPlaceholder = "Tìm kiếm…",
  disabled = false,
  loading = false,
  emptyMessage = "Không có model"
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find(option => option.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => (
      option.label.toLowerCase().includes(needle)
      || option.value.toLowerCase().includes(needle)
    ));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const handleKeyDown = event => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectOption(option) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  const buttonLabel = loading
    ? "Đang tải danh sách…"
    : selected?.label || selected?.value || placeholder;

  return (
    <div className={`searchable-menu-dropdown${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="searchable-menu-trigger"
        onClick={() => {
          if (disabled || loading) return;
          setOpen(current => !current);
        }}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="searchable-menu-trigger-label">{buttonLabel}</span>
        <ChevronDown size={16} className="searchable-menu-chevron" />
      </button>

      {open && (
        <div className="searchable-menu-panel" role="presentation">
          <label className="searchable-menu-search">
            <Search size={14} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              onKeyDown={event => {
                if (event.key === "Enter" && filtered[0]) {
                  event.preventDefault();
                  selectOption(filtered[0]);
                }
              }}
            />
          </label>
          <ul id={listId} className="searchable-menu-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="searchable-menu-empty">{emptyMessage}</li>
            ) : filtered.map(option => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`searchable-menu-option${option.value === value ? " is-selected" : ""}`}
                  onClick={() => selectOption(option)}
                >
                  <span className="searchable-menu-option-label">{option.label}</span>
                  {option.label !== option.value && (
                    <span className="searchable-menu-option-value">{option.value}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
