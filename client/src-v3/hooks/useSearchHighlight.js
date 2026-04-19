import { useEffect } from "react";

// Search highlight hook — scrolls to and highlights a matching row after tab navigation

function useSearchHighlight(searchHighlight, clearSearchHighlight, tabName, options) {
  useEffect(() => {
    if (!searchHighlight || searchHighlight.tab !== tabName) return;

    const { itemId, collection, householdId } = searchHighlight;

    // For people results in guests tab, scroll to the household card instead
    const targetId = (collection === "people" && householdId)
      ? `row-${householdId}`
      : `row-${itemId}`;

    // Optional: expand household if it's a people result
    if (collection === "people" && householdId && options?.setExpandedHH) {
      options.setExpandedHH(householdId);
    }

    // Small delay to allow tab render to complete before scrolling
    const timer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("search-highlight");
        // Remove class after animation completes so it can re-trigger if searched again
        setTimeout(() => {
          el.classList.remove("search-highlight");
          clearSearchHighlight();
        }, 3100);
      } else {
        clearSearchHighlight();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchHighlight]);
}

export { useSearchHighlight };
