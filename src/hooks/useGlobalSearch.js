import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSearchIndex, searchIndex } from "../utils/searchIndex";

/**
 * Global search hook with debouncing and indexing
 * - Builds searchable index from app data
 * - Debounces search input (300ms)
 * - Performs fast searches on the built index
 * - Supports keyboard navigation
 */
export function useGlobalSearch(appData = {}, debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimerRef = useRef(null);

  // Build searchable index once from app data (memoized)
  const searchableIndex = useMemo(() => {
    return buildSearchIndex(appData);
  }, [appData]);

  // Debounced search: waits for user to stop typing before searching
  const performSearch = useCallback((searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the search
    debounceTimerRef.current = setTimeout(() => {
      const searchResults = searchIndex(searchQuery, searchableIndex, 15);
      setResults(searchResults);
      setSelectedIndex(-1); // Reset selection when new results come in
      setIsOpen(true);
    }, debounceMs);
  }, [searchableIndex, debounceMs]);

  // Handle query change
  const handleQueryChange = useCallback(
    (newQuery) => {
      setQuery(newQuery);
      performSearch(newQuery);
    },
    [performSearch]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          // Return selected result for parent to handle navigation
          return results[selectedIndex];
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
        break;
      default:
        break;
    }
  }, [isOpen, results, selectedIndex]);

  // Get selected result
  const selectedResult = selectedIndex >= 0 ? results[selectedIndex] : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery: handleQueryChange,
    results,
    selectedIndex,
    setSelectedIndex,
    selectedResult,
    isOpen,
    setIsOpen,
    handleKeyDown,
  };
}
