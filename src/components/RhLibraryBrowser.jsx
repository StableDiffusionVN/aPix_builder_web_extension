import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownToLine, ExternalLink, Heart, LoaderCircle, Play, Search, X } from "lucide-react";
import { categoryName, ensureLibraryHeaderRules, fetchRhLibraryList, fetchRhLibraryTags } from "../services/rhLibrary";
import { getLocale, t } from "../lib/i18n";
import { useI18n } from "../lib/I18nContext";

const SORTS = [
  { id: "RECOMMEND", labelKey: "rhlib.sort.recommend" },
  { id: "HOTTEST", labelKey: "rhlib.sort.hottest" },
  { id: "NEWEST", labelKey: "rhlib.sort.newest" }
];

function formatCount(value) {
  try {
    return new Intl.NumberFormat(getLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
  } catch {
    return String(value || 0);
  }
}

/// Thư viện duyệt AI App RunningHub — overlay trong side panel; chọn card → Import chạy flow addCustomApp.
export function RhLibraryBrowser({ open, onClose, onImport, importing = false }) {
  const { lang } = useI18n();
  const [tags, setTags] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("RECOMMEND");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const requestSeq = useRef(0);
  const listRef = useRef(null);

  const activeTags = useMemo(() => {
    const category = tags.find(tag => tag.id === categoryId);
    return category ? category.children.map(child => child.id) : [];
  }, [tags, categoryId]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [open, searchInput]);

  useEffect(() => {
    if (!open) return;
    ensureLibraryHeaderRules();
    if (tags.length) return;
    fetchRhLibraryTags().then(setTags).catch(() => {});
  }, [open, tags.length]);

  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setFailed(false);
    setSelected(null);
    listRef.current?.scrollTo?.({ top: 0 });
    fetchRhLibraryList({ tags: activeTags, search, sort, page: 1 })
      .then(result => {
        if (seq !== requestSeq.current) return;
        setRecords(result.records);
        setTotal(result.total);
        setPage(1);
      })
      .catch(() => {
        if (seq === requestSeq.current) setFailed(true);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [open, activeTags, search, sort]);

  async function loadMore() {
    if (loading || records.length >= total) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const result = await fetchRhLibraryList({ tags: activeTags, search, sort, page: page + 1 });
      if (seq !== requestSeq.current) return;
      setRecords(current => {
        const seen = new Set(current.map(record => record.id));
        return [...current, ...result.records.filter(record => !seen.has(record.id))];
      });
      setTotal(result.total);
      setPage(current => current + 1);
    } catch { /* giữ trang hiện tại */ } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="rh-library-overlay" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="rh-library-panel" role="dialog" aria-modal="true" aria-label={t("rhlib.title")}>
        <header className="rh-library-header">
          <h2>{t("rhlib.title")}</h2>
          <button type="button" className="square-button" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </header>
        <div className="rh-library-filters">
          <div className="rh-library-search">
            <Search size={13} />
            <input
              type="search"
              value={searchInput}
              placeholder={t("rhlib.searchPlaceholder")}
              onChange={event => setSearchInput(event.target.value)}
            />
          </div>
          <select value={categoryId} onChange={event => setCategoryId(event.target.value)} aria-label={t("rhlib.categoryAria")}>
            <option value="">{t("rhlib.allCategories")}</option>
            {tags.map(tag => <option key={tag.id} value={tag.id}>{categoryName(tag.id, lang, tag.name)}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)} aria-label={t("rhlib.sortAria")}>
            {SORTS.map(option => <option key={option.id} value={option.id}>{t(option.labelKey)}</option>)}
          </select>
        </div>
        <div className="rh-library-count">{loading && !records.length ? t("common.loading") : t("rhlib.results", { count: formatCount(total) })}</div>
        <div
          className="rh-library-grid"
          ref={listRef}
          onScroll={event => {
            const target = event.currentTarget;
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 400) void loadMore();
          }}
        >
          {failed && !records.length ? (
            <p className="rh-library-error">{t("rhlib.loadFailed")}</p>
          ) : records.map(record => (
            <button
              key={record.id}
              type="button"
              className={`rh-library-card${selected?.id === record.id ? " is-selected" : ""}`}
              onClick={() => setSelected(current => (current?.id === record.id ? null : record))}
              title={record.originalName || record.name}
            >
              <span className="rh-library-cover">
                {record.coverUrl
                  ? <img src={record.coverUrl} alt="" loading="lazy" />
                  : <Play size={18} />}
              </span>
              <span className="rh-library-name">{record.name}</span>
              <span className="rh-library-stats">
                <Play size={9} /> {formatCount(record.useCount)}
                <Heart size={9} /> {formatCount(record.likeCount)}
              </span>
            </button>
          ))}
          {loading && records.length ? <div className="rh-library-loading"><LoaderCircle className="spin" size={16} /></div> : null}
        </div>
        {selected ? (
          <footer className="rh-library-footer">
            <strong title={selected.name}>{selected.name}</strong>
            <a href={`https://www.runninghub.ai/ai-detail/${selected.id}`} target="_blank" rel="noreferrer" aria-label={t("rhlib.openOn")}>
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              className="rh-library-import"
              disabled={importing}
              onClick={() => onImport?.(selected)}
            >
              {importing ? <LoaderCircle className="spin" size={13} /> : <ArrowDownToLine size={13} />} {t("rhlib.importNow")}
            </button>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body
  );
}
