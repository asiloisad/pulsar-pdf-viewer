// supress all output from pdfjs
console.log = console.error = console.warn = () => {}

window.onload = () => {
  PDFViewerApplicationOptions.set("sidebarViewOnLoad", 0)
  PDFViewerApplicationOptions.set("defaultZoomValue", 'auto')
  PDFViewerApplicationOptions.set("enableScripting", false)
  PDFViewerApplicationOptions.set("externalLinkTarget", 4)
  PDFViewerApplicationOptions.set("isEvalSupported", false)
  PDFViewerApplicationOptions.set("disableHistory", true)
}

window.addEventListener('keydown', (event) => {
  if (event.keyCode===119) {
    return toggleInvertMode()
  } else if (event.ctrlKey && event.keyCode===116) {
    return parent.postMessage({type:'keydown', action:'toggle-refreshing'})
  } else if (event.keyCode===116) {
    return refreshContents({filePath:PDFViewerApplication.url})
  } else if (event.keyCode===112) {
    return parent.postMessage({type:'keydown', action:'command-palette:toggle'})
  } else if (event.altKey && event.keyCode===78) {
    return parent.postMessage({type:'keydown', action:'navigation-panel:toggle'})
  } else if (event.altKey && event.keyCode===123) {
    return parent.postMessage({type:'keydown', action:'open-external:open-external'})
  } else if (event.ctrlKey && event.keyCode===123) {
    return parent.postMessage({type:'keydown', action:'open-external:show-in-folder'})
  } else if (event.altKey && event.keyCode===121) {
    return parent.postMessage({type:'keydown', action:'project-files:recent-toggle'})
  } else if (event.keyCode===121) {
    return parent.postMessage({type:'keydown', action:'project-files:projects-toggle'})
  }
})

window.addEventListener('click', () => {
  parent.postMessage({type:'click'})
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
  parent.postMessage({type:'contextmenu', pageNo:pageNo, x:x, y:y})
})

window.addEventListener("message", (message) => {
  if (message.source!==parent) {
    return
  } else if (message.data.type==='refresh') {
    return refreshContents(message.data);
  } else if (message.data.type==='setposition') {
    return scrollToPosition(message.data);
  } else if (message.data.type==='setdestination') {
    return scrollToDestination(message.data);
  } else if (message.data.type==='invert') {
    return toggleInvertMode(message.data)
  } else if (message.data.type==='currentdest') {
    return spawnCurrentDest(message.data)
  }
})

let lastParams = { page:1, zoom:'auto' }

function refreshContents(data) {
  if (window.frameElement && window.frameElement.style.display==="none") {
    return
  } else if (PDFViewerApplication.pagesCount>1) {
    lastParams.page = PDFViewerApplication.page
    lastParams.zoom = PDFViewerApplication.pdfViewer.currentScaleValue
    if (/^\d+(?:\.\d+)?$/.test(lastParams.zoom)) {
      lastParams.zoom = parseFloat(lastParams.zoom)*100
    }
  }
  PDFViewerApplication.initialBookmark = `page=${lastParams.page}&zoom=${lastParams.zoom}`;
  PDFViewerApplication.open(data.filePath)
}

function scrollToPosition(data) {
  const pageView = PDFViewerApplication.pdfViewer.getPageView(data.page);
  const clientHeight = PDFViewerApplication.appConfig.mainContainer.clientHeight;
  const clientWidth = PDFViewerApplication.appConfig.mainContainer.clientWidth;
  const height = pageView.div.offsetTop;
  const [, y1,, y2] = pageView.viewport.viewBox;
  const [x, y] = pageView.viewport.convertToViewportPoint(data.x, y2-y1-data.y);
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

function spawnCurrentDest() {
  PDFViewerApplication.pdfOutlineViewer._currentOutlineItem()
}
