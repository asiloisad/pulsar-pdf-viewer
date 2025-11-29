// supress output from pdfjs
const _console = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};
console.log = console.info = console.warn = () => {};
// console.error = () => { }; // Keep errors for now

// Polyfill for URL.parse (required by PDF.js v5)
if (!URL.parse) {
  URL.parse = function (url, base) {
    try {
      return new URL(url, base);
    } catch (e) {
      return null;
    }
  };
}

let cachedOutline = null;
let pendingRefreshData = null;

// Watch for visibility changes to handle pending refresh when tab becomes visible
function setupVisibilityObserver() {
  if (!window.frameElement) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "style"
      ) {
        const display = window.frameElement.style.display;
        if (display !== "none" && pendingRefreshData) {
          // We just became visible and have a pending refresh
          const data = pendingRefreshData;
          pendingRefreshData = null;
          refreshContents(data);
        }
      }
    }
  });

  observer.observe(window.frameElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
}

window.onload = () => {
  PDFViewerApplicationOptions.set("sidebarViewOnLoad", 0);
  PDFViewerApplicationOptions.set("defaultZoomValue", "auto");
  PDFViewerApplicationOptions.set("enableScripting", false);
  PDFViewerApplicationOptions.set("externalLinkTarget", 4);
  PDFViewerApplicationOptions.set("isEvalSupported", false);
  PDFViewerApplicationOptions.set("disableHistory", true);
  setupVisibilityObserver();
  parent.postMessage({ type: "ready" });

  PDFViewerApplication.eventBus.on("pagesinit", async () => {
    const outline = await PDFViewerApplication.pdfDocument.getOutline();

    if (outline) {
      // Enrich outline with destHash and pre-resolve destinations
      await enrichItems(outline);
      cachedOutline = outline;
    }

    parent.postMessage({ type: "pdfjsOutline", outline: outline });

    // Send initial scroll-map data after outline is ready
    spawnCurrentDest();
  });

  // Also listen for pagechanging and updateviewarea to update the outline item automatically
  const updateCurrent = () => spawnCurrentDest();
  PDFViewerApplication.eventBus.on("pagechanging", updateCurrent);
  PDFViewerApplication.eventBus.on("updateviewarea", updateCurrent);
};

// Helper to recursively enrich items and resolve destinations
async function enrichItems(items) {
  for (const item of items) {
    if (item.dest) {
      // 1. Get Hash
      item.destHash = PDFViewerApplication.pdfLinkService.getDestinationHash(
        item.dest
      );

      // 2. Resolve to Page Index and Coordinates (for fast scroll checking)
      try {
        let dest = item.dest;
        if (typeof dest === "string") {
          dest = await PDFViewerApplication.pdfDocument.getDestination(dest);
        }

        // Skip if destination couldn't be resolved (null or not an array)
        if (!dest || !Array.isArray(dest)) {
          continue;
        }

        const pageRef = dest[0];
        let pageIndex;

        if (typeof pageRef === "object") {
          pageIndex = await PDFViewerApplication.pdfDocument.getPageIndex(
            pageRef
          );
        } else if (Number.isInteger(pageRef)) {
          pageIndex = pageRef;
        }

        if (pageIndex !== undefined) {
          item.resolvedDest = {
            pageIndex: pageIndex,
            x: dest[2],
            y: dest[3],
          };
        }
      } catch (e) {
        // Ignore errors for unresolvable destinations (e.g., missing named destinations)
      }
    }

    if (item.items && item.items.length > 0) {
      await enrichItems(item.items);
    }
  }
}

async function spawnCurrentDest() {
  // If we have cached outline with resolved destinations, use it for fast sync calculation
  if (cachedOutline) {
    const pdfViewer = PDFViewerApplication.pdfViewer;
    const container = pdfViewer.container;
    const scrollTop = container.scrollTop;
    const scrollBottom = scrollTop + container.clientHeight;
    const visibleHashes = [];

    // Flatten outline for linear scan, tracking nesting level
    const flattenOutline = (items, level = 0, result = []) => {
      for (const item of items) {
        result.push({ item, level });
        if (item.items && item.items.length > 0) {
          flattenOutline(item.items, level + 1, result);
        }
      }
      return result;
    };

    const flatItems = flattenOutline(cachedOutline);
    const itemPositions = [];

    // Calculate current Y positions (synchronous)
    for (const { item, level } of flatItems) {
      if (item.resolvedDest) {
        const pageView = pdfViewer.getPageView(item.resolvedDest.pageIndex);
        if (pageView && pageView.div) {
          // Get Y position within page from PDF coordinates
          // PDF y-coordinate is from bottom, convert to top-down viewport position
          const viewport = pageView.viewport;
          const pdfY = item.resolvedDest.y || 0;
          // viewport.height is the rendered page height
          // Scale the PDF y-coordinate to viewport pixels
          const scale = viewport.scale;
          const yInPage = (viewport.viewBox[3] - pdfY) * scale;

          // Absolute Y in container = page top + position within page
          const absoluteY = pageView.div.offsetTop + yInPage;
          itemPositions.push({ item, level, y: absoluteY });
        }
      }
    }

    // Sort by Y
    itemPositions.sort((a, b) => a.y - b.y);

    // Check visibility
    for (let i = 0; i < itemPositions.length; i++) {
      const current = itemPositions[i];
      const next = itemPositions[i + 1];

      const startY = current.y;
      // If no next item, assume end of document (or end of last page)
      const endY = next
        ? next.y
        : pdfViewer.getPageView(pdfViewer.pagesCount - 1).div.offsetTop +
          pdfViewer.getPageView(pdfViewer.pagesCount - 1).div.clientHeight;

      if (startY < scrollBottom && endY > scrollTop) {
        if (current.item.destHash) {
          visibleHashes.push(current.item.destHash);
        }
      }
    }

    // Send current outline item(s) if any are visible
    parent.postMessage({
      type: "currentOutlineItem",
      destHash: visibleHashes,
    });

    // Send scroll-map data with all outline positions
    // Account for toolbar height - container.offsetTop gives the offset from the iframe top
    const toolbarHeight = container.offsetTop;
    const totalHeight = container.scrollHeight;
    const iframeHeight = window.innerHeight;
    const scrollableHeight = iframeHeight - toolbarHeight;

    if (totalHeight > 0 && itemPositions.length > 0) {
      // Calculate percent within the scrollable area (excluding toolbar)
      // Map positions to the visible scroll-map area
      const toolbarPercent = (toolbarHeight / iframeHeight) * 100;
      const contentPercent = (scrollableHeight / iframeHeight) * 100;

      const scrollMapItems = itemPositions.map((pos) => ({
        // Offset by toolbar and scale to the content area
        percent: toolbarPercent + (pos.y / totalHeight) * contentPercent,
        page: pos.item.resolvedDest?.pageIndex,
        x: pos.item.resolvedDest?.x || 0,
        y: pos.item.resolvedDest?.y || 0,
        level: pos.level,
        isCurrent: visibleHashes.includes(pos.item.destHash),
      }));
      parent.postMessage({
        type: "scrollMapData",
        items: scrollMapItems,
        scrollPercent: (scrollTop / totalHeight) * 100,
      });
    }
    return;
  }

  // Fallback for non-cached (shouldn't happen after init) or if pre-calc failed
  // ... (omitted for brevity, relying on cachedOutline)
}

// Send click event to parent to activate pane
window.addEventListener(
  "mousedown",
  (event) => {
    parent.postMessage({ type: "click", button: event.button });
  },
  true
);

window.addEventListener(
  "keydown",
  (event) => {
    // Handle F5 variants first with explicit modifier checks
    if (event.keyCode === 116) {
      // F5
      event.preventDefault();
      event.stopPropagation();
      if (event.ctrlKey && (event.altKey || event.shiftKey)) {
        // Ctrl+Alt+F5 or Ctrl+Shift+F5 - window reload
        return parent.postMessage({ type: "keydown", action: "window:reload" });
      } else if (event.ctrlKey) {
        // Ctrl+F5 - toggle auto-refresh
        return parent.postMessage({
          type: "keydown",
          action: "toggle-refreshing",
        });
      } else if (!event.altKey && !event.shiftKey) {
        // F5 - refresh PDF
        return refreshContents({ filePath: PDFViewerApplication.url });
      }
      return; // Other combos - do nothing
    }
    // F6 - compile LaTeX
    if (
      event.keyCode === 117 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      return parent.postMessage({
        type: "keydown",
        action: "pdf-viewer:compile",
      });
    }
    // F7 - open associated .tex file
    if (
      event.keyCode === 118 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      return parent.postMessage({
        type: "keydown",
        action: "pdf-viewer:open-tex",
      });
    }
    if (event.keyCode === 119) {
      return toggleInvertMode();
    } else if (event.ctrlKey && event.keyCode === 80) {
      // Ctrl+P
      event.preventDefault();
      return parent.postMessage({
        type: "keydown",
        action: "fuzzy-finder:toggle-file-finder",
      });
    } else if (event.keyCode === 112) {
      return parent.postMessage({
        type: "keydown",
        action: "command-palette:toggle",
      });
    } else if (event.altKey && event.keyCode === 78) {
      return parent.postMessage({
        type: "keydown",
        action: "navigation-panel:toggle",
      });
    } else if (event.altKey && event.keyCode === 123) {
      return parent.postMessage({
        type: "keydown",
        action: "open-external:open",
      });
    } else if (event.ctrlKey && event.keyCode === 123) {
      return parent.postMessage({
        type: "keydown",
        action: "open-external:show",
      });
    } else if (event.altKey && event.keyCode === 121) {
      // return parent.postMessage({type:'keydown', action:'project-list:recent'})
    } else if (event.keyCode === 121) {
      // return parent.postMessage({type:'keydown', action:'project-list:toggle'})
    } else if (event.altKey && event.keyCode === 37) {
      return parent.postMessage({
        type: "keydown",
        action: "window:focus-pane-on-left",
      });
    } else if (event.altKey && event.keyCode === 38) {
      return parent.postMessage({
        type: "keydown",
        action: "window:focus-pane-above",
      });
    } else if (event.altKey && event.keyCode === 39) {
      return parent.postMessage({
        type: "keydown",
        action: "window:focus-pane-on-right",
      });
    } else if (event.altKey && event.keyCode === 40) {
      return parent.postMessage({
        type: "keydown",
        action: "window:focus-pane-below",
      });
    }
  },
  true
);

window.addEventListener(
  "contextmenu",
  (event) => {
    const page = event.target.closest("div.page");
    if (!page) {
      return;
    }
    const pageNo = parseInt(page.getAttribute("data-page-number"), 10);
    if (isNaN(pageNo)) {
      return;
    }
    const bounds = page.querySelector("canvas").getBoundingClientRect();
    const rot = PDFViewerApplication.pdfViewer.pagesRotation;
    switch (rot) {
      case 0:
        var x = event.clientX - bounds.left;
        var y = event.clientY - bounds.top;
        break;
      case 90:
        var x = event.clientY - bounds.top;
        var y = bounds.right - event.clientX;
        break;
      case 180:
        var x = bounds.right - event.clientX;
        var y = bounds.bottom - event.clientY;
        break;
      case 270:
        var x = bounds.bottom - event.clientY;
        var y = event.clientX - bounds.left;
        break;
    }
    const res = PDFViewerApplication.pdfViewer.currentScale * 96;
    x = Math.round((x / res) * 72);
    y = Math.round((y / res) * 72);
    parent.postMessage({ type: "contextmenu", pageNo: pageNo, x: x, y: y });
  },
  true
);

window.addEventListener("message", (message) => {
  if (message.source !== parent) {
    return;
  } else if (message.data.type === "refresh") {
    return refreshContents(message.data);
  } else if (message.data.type === "setposition") {
    return scrollToPosition(message.data);
  } else if (message.data.type === "setdestination") {
    return scrollToDestination(message.data);
  } else if (message.data.type === "invert") {
    return toggleInvertMode(message.data);
  } else if (message.data.type === "currentdest") {
    return spawnCurrentDest(message.data);
  }
});

let lastParams = { page: 1, zoom: "auto" };

function refreshContents(data) {
  if (window.frameElement && window.frameElement.style.display === "none") {
    // Store the refresh request for when we become visible
    pendingRefreshData = data;
    return;
  }
  // Clear any pending refresh since we're doing it now
  pendingRefreshData = null;
  if (PDFViewerApplication.pagesCount > 1) {
    lastParams.page = PDFViewerApplication.page;
    lastParams.zoom = PDFViewerApplication.pdfViewer.currentScaleValue;
    if (/^\d+(?:\.\d+)?$/.test(lastParams.zoom)) {
      lastParams.zoom = parseFloat(lastParams.zoom) * 100;
    }
  }
  PDFViewerApplication.initialBookmark = `page=${lastParams.page}&zoom=${lastParams.zoom}`;
  PDFViewerApplication.open({ url: data.filePath });
}

function scrollToPosition(data) {
  const pageView = PDFViewerApplication.pdfViewer.getPageView(data.page);
  const clientHeight =
    PDFViewerApplication.appConfig.mainContainer.clientHeight;
  const clientWidth = PDFViewerApplication.appConfig.mainContainer.clientWidth;
  const height = pageView.div.offsetTop;
  const [, y1, , y2] = pageView.viewport.viewBox;
  const [x, y] = pageView.viewport.convertToViewportPoint(
    data.x,
    y2 - y1 - data.y
  );
  const percentDown = 0.5;
  const percentAcross = 0.5;
  PDFViewerApplication.pdfViewer.container.scrollTo({
    top: height + y - clientHeight * percentDown,
    left: x - clientWidth * percentAcross,
  });
}

function scrollToDestination(data) {
  PDFViewerApplication.pdfLinkService.goToDestination(data.dest);
}

let stateInvertMode;

function toggleInvertMode(data) {
  stateInvertMode = data ? data.initial : !stateInvertMode;
  css = stateInvertMode
    ? ".page, .thumbnailImage {filter: invert(100%);}"
    : ".page, .thumbnailImage {filter: invert(0%);}";
  document.getElementById("viewer-less").innerText = css;
}
