console.log   = () => {}
console.error = () => {}
console.warn  = () => {}

window.onload = () => {
  PDFViewerApplicationOptions.set("sidebarViewOnLoad", 0);
  PDFViewerApplicationOptions.set("externalLinkTarget", 4);
  PDFViewerApplicationOptions.set("isEvalSupported", false);
}

window.addEventListener("message", event => {
  const type = event.data.type;
  const data = event.data.data;
  switch (type) {
    case "refresh":
      refreshContents(data.filepath);
      return;
    case "setposition":
      scrollToPosition(data);
      return;
    default:
      throw new Error(`Unexpected message type "${type}" received`);
  }
});

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
