// supress all output from pdfjs
console.log = console.error = console.warn = () => { }

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

window.onload = () => {
  PDFViewerApplicationOptions.set("sidebarViewOnLoad", 0)
  PDFViewerApplicationOptions.set("defaultZoomValue", 'auto')
  PDFViewerApplicationOptions.set("enableScripting", false)
  PDFViewerApplicationOptions.set("externalLinkTarget", 4)
  PDFViewerApplicationOptions.set("isEvalSupported", false)
  PDFViewerApplicationOptions.set("disableHistory", true)
  parent.postMessage({ type: 'ready' })

  PDFViewerApplication.eventBus.on('pagesinit', async () => {
    const outline = await PDFViewerApplication.pdfDocument.getOutline();

    if (outline) {
      // Enrich outline with destHash and pre-resolve destinations
      await enrichItems(outline);
      cachedOutline = outline;
    }

    parent.postMessage({ type: 'pdfjsOutline', outline: outline });
  });

  // Also listen for pagechanging and updateviewarea to update the outline item automatically
  const updateCurrent = () => spawnCurrentDest();
  PDFViewerApplication.eventBus.on('pagechanging', updateCurrent);
  PDFViewerApplication.eventBus.on('updateviewarea', updateCurrent);
}

// Helper to recursively enrich items and resolve destinations
async function enrichItems(items) {
  for (const item of items) {
    if (item.dest) {
      // 1. Get Hash
      item.destHash = PDFViewerApplication.pdfLinkService.getDestinationHash(item.dest);

      // 2. Resolve to Page Index and Coordinates (for fast scroll checking)
      try {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await PDFViewerApplication.pdfDocument.getDestination(dest);
        }

        if (Array.isArray(dest)) {
          const pageRef = dest[0];
          let pageIndex;

          if (typeof pageRef === 'object') {
            pageIndex = await PDFViewerApplication.pdfDocument.getPageIndex(pageRef);
          } else if (Number.isInteger(pageRef)) {
            pageIndex = pageRef;
          }

          if (pageIndex !== undefined) {
            item.resolvedDest = {
              pageIndex: pageIndex,
              x: dest[2],
              y: dest[3]
            };
          }
        }
      } catch (e) {
        console.error("Error resolving dest for item", item, e);
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

    // Flatten outline for linear scan
    const flattenOutline = (items, result = []) => {
      for (const item of items) {
        result.push(item);
        if (item.items && item.items.length > 0) {
          flattenOutline(item.items, result);
        }
      }
      return result;
    };

    const flatItems = flattenOutline(cachedOutline);
    const itemPositions = [];

    // Calculate current Y positions (synchronous)
    for (const item of flatItems) {
      if (item.resolvedDest) {
        const pageView = pdfViewer.getPageView(item.resolvedDest.pageIndex);
        if (pageView && pageView.div) {
          const viewport = pageView.viewport;
          // Convert PDF point to viewport point
          // Note: convertToViewportPoint returns [x, y] relative to page
          const [x, y] = viewport.convertToViewportPoint(item.resolvedDest.x, item.resolvedDest.y);

          // Absolute Y in container
          const absoluteY = pageView.div.offsetTop + y;
          itemPositions.push({ item, y: absoluteY });
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
      const endY = next ? next.y : pdfViewer.getPageView(pdfViewer.pagesCount - 1).div.offsetTop + pdfViewer.getPageView(pdfViewer.pagesCount - 1).div.clientHeight;

      if (startY < scrollBottom && endY > scrollTop) {
        if (current.item.destHash) {
          visibleHashes.push(current.item.destHash);
        }
      }
    }

    if (visibleHashes.length > 0) {
      parent.postMessage({ type: 'currentOutlineItem', destHash: visibleHashes });
    }
    return;
  }

  // Fallback for non-cached (shouldn't happen after init) or if pre-calc failed
  // ... (omitted for brevity, relying on cachedOutline)
}

window.addEventListener('keydown', (event) => {
  if (event.keyCode === 119) {
    return toggleInvertMode()
  } else if (event.ctrlKey && event.keyCode === 116) {
    return parent.postMessage({ type: 'keydown', action: 'toggle-refreshing' })
  } else if (event.keyCode === 116) {
    return refreshContents({ filePath: PDFViewerApplication.url })
  } else if (event.keyCode === 112) {
    return parent.postMessage({ type: 'keydown', action: 'command-palette:toggle' })
  } else if (event.altKey && event.keyCode === 78) {
    return parent.postMessage({ type: 'keydown', action: 'navigation-panel:toggle' })
  } else if (event.altKey && event.keyCode === 123) {
    return parent.postMessage({ type: 'keydown', action: 'open-external:open' })
  } else if (event.ctrlKey && event.keyCode === 123) {
    return parent.postMessage({ type: 'keydown', action: 'open-external:show' })
  } else if (event.altKey && event.keyCode === 121) {
    // return parent.postMessage({type:'keydown', action:'project-list:recent'})
  } else if (event.keyCode === 121) {
    // return parent.postMessage({type:'keydown', action:'project-list:toggle'})
  } else if (event.altKey && event.keyCode === 37) {
    return parent.postMessage({ type: 'keydown', action: 'window:focus-pane-on-left' })
  } else if (event.altKey && event.keyCode === 38) {
    return parent.postMessage({ type: 'keydown', action: 'window:focus-pane-above' })
  } else if (event.altKey && event.keyCode === 39) {
    return parent.postMessage({ type: 'keydown', action: 'window:focus-pane-on-right' })
  } else if (event.altKey && event.keyCode === 40) {
    return parent.postMessage({ type: 'keydown', action: 'window:focus-pane-below' })
  }
})

window.addEventListener('click', () => {
  parent.postMessage({ type: 'click' })
})

window.addEventListener('contextmenu', (event) => {
  const page = event.target.closest('div.page')
  if (!page) { return }
  const pageNo = parseInt(page.getAttribute('data-page-number'), 10)
  if (isNaN(pageNo)) { return }
  const bounds = page.querySelector('canvas').getBoundingClientRect();
  const rot = PDFViewerApplication.pdfViewer.pagesRotation
  switch (rot) {
    case 0:
      var x = event.clientX - bounds.left
      var y = event.clientY - bounds.top
      break;
    case 90:
      var x = event.clientY - bounds.top
      var y = bounds.right - event.clientX
      break;
    case 180:
      var x = bounds.right - event.clientX
      var y = bounds.bottom - event.clientY
      break;
    case 270:
      var x = bounds.bottom - event.clientY
      var y = event.clientX - bounds.left
      break;
  }
  const res = PDFViewerApplication.pdfViewer.currentScale * 96
  x = Math.round(x / res * 72)
  y = Math.round(y / res * 72)
  parent.postMessage({ type: 'contextmenu', pageNo: pageNo, x: x, y: y })
})

window.addEventListener("message", (message) => {
  if (message.source !== parent) {
    return
  } else if (message.data.type === 'refresh') {
    return refreshContents(message.data);
  } else if (message.data.type === 'setposition') {
    return scrollToPosition(message.data);
  } else if (message.data.type === 'setdestination') {
    return scrollToDestination(message.data);
  } else if (message.data.type === 'invert') {
    return toggleInvertMode(message.data)
  } else if (message.data.type === 'currentdest') {
    return spawnCurrentDest(message.data)
  }
})

let lastParams = { page: 1, zoom: 'auto' }

function refreshContents(data) {
  if (window.frameElement && window.frameElement.style.display === "none") {
    return
  } else if (PDFViewerApplication.pagesCount > 1) {
    lastParams.page = PDFViewerApplication.page
    lastParams.zoom = PDFViewerApplication.pdfViewer.currentScaleValue
    if (/^\d+(?:\.\d+)?$/.test(lastParams.zoom)) {
      lastParams.zoom = parseFloat(lastParams.zoom) * 100
    }
  }
  PDFViewerApplication.initialBookmark = `page=${lastParams.page}&zoom=${lastParams.zoom}`;
  PDFViewerApplication.open({ url: data.filePath })
}

function scrollToPosition(data) {
  const pageView = PDFViewerApplication.pdfViewer.getPageView(data.page);
  const clientHeight = PDFViewerApplication.appConfig.mainContainer.clientHeight;
  const clientWidth = PDFViewerApplication.appConfig.mainContainer.clientWidth;
  const height = pageView.div.offsetTop;
  const [, y1, , y2] = pageView.viewport.viewBox;
  const [x, y] = pageView.viewport.convertToViewportPoint(data.x, y2 - y1 - data.y);
  const percentDown = 0.50; const percentAcross = 0.50;
  PDFViewerApplication.pdfViewer.container.scrollTo({
    top: height + y - clientHeight * percentDown,
    left: x - clientWidth * percentAcross,
  });
}

function scrollToDestination(data) {
  PDFViewerApplication.pdfLinkService.goToDestination(data.dest)
}

let stateInvertMode

function toggleInvertMode(data) {
  stateInvertMode = data ? data.initial : !stateInvertMode
  css = stateInvertMode ? '.page, .thumbnailImage {filter: invert(100%);}' : '.page, .thumbnailImage {filter: invert(0%);}'
  document.getElementById('viewer-less').innerText = css
}
