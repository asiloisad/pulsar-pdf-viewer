// supress all output from pdfjs
console.log   = () => {}
console.error = () => {}
console.warn  = () => {}

window.onload = () => {
  PDFViewerApplicationOptions.set("sidebarViewOnLoad", 0);
  PDFViewerApplicationOptions.set("defaultZoomValue", 'page-width');
  PDFViewerApplicationOptions.set("enableScripting", false);
  PDFViewerApplicationOptions.set("externalLinkTarget", 4);
  PDFViewerApplicationOptions.set("isEvalSupported", false);
  PDFViewerApplicationOptions.set("disableHistory", true);
}

window.addEventListener("message", event => {
  const type = event.data.type;
  const data = event.data.data;
  switch (type) {
    case "refresh":
      return refreshContents(data.filePath);
    case "setposition":
      return scrollToPosition(data);
    default:
      throw new Error(`Unexpected message type "${type}" received`);
  }
});

function refreshContents(filePath) {
  try {
    if (typeof filePath !== "string") {
      throw new Error(`Expected string as filepath, got ${filePath}`);
    }
    if (window.frameElement && window.frameElement.style.display === "none") {
      // we are not in view; don't bother updating
      lastFilepath = filePath;
      styleObserver.observe(window.frameElement, {
        attributes: true,
        attributeFilter: ["style"],
      });
      return;
    }
    lastParams = getDocumentParams() || lastParams;
    PDFViewerApplication.open(filePath);
    document.addEventListener("pagesinit",() => {restoreFromParams(lastParams)},{once: true, passive: true}
    );
  } catch (err) {}
}

function getDocumentParams() {
  const container = document.getElementById("viewerContainer");
  const params = {
    scale: PDFViewerApplication.pdfViewer.currentScaleValue,
    scrollTop: container.scrollTop,
    scrollLeft: container.scrollLeft,
  };
  // When the PDF is incomplete (e.g., long rebuild), scale will be null. Probably.
  if (params.scale !== null) {
    return params;
  } else {
    return undefined;
  }
}

function scrollToPosition({pageIndex, pointX, pointY, origin}) {
  const pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

  const clientHeight = PDFViewerApplication.appConfig.mainContainer.clientHeight;
  const clientWidth = PDFViewerApplication.appConfig.mainContainer.clientWidth;

  const height = pageView.div.offsetTop;

  if (origin === "TL") {
    const [, y1,, y2] = pageView.viewport.viewBox;
    pointY = y2 - y1 - pointY;
  }

  const [x, y] = pageView.viewport.convertToViewportPoint(pointX, pointY);

  const percentDown = 0.50;
  const percentAcross = 0.50;

  PDFViewerApplication.pdfViewer.container.scrollTo({
    top: height + y - clientHeight * percentDown,
    left: x - clientWidth * percentAcross,
  });
}
