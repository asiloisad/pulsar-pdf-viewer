const { CompositeDisposable, Disposable, File } = require("atom");
const path = require("path");
const fs = require("fs");

module.exports = class Viewer {
  constructor(filePath, hash) {
    this.disposables = new CompositeDisposable();
    this.subscriptions = new CompositeDisposable();
    this.onDidChangeTitleCallbacks = new Set();
    this.observeOutlineCallbacks = new Set();
    this.observeVisibleCallbacks = new Set();
    this.observeScrollMapDataCallbacks = new Set();
    this.outlineLoaded = false;
    this.messageHandlers = {
      click: (data) => this.handleClickMessage(data),
      keydown: (data) => this.handleKeydown(data),
      contextmenu: (data) => this.handleSynctex(data),
      pdfjsOutline: (data) => this.handleOutlineMessage(data),
      visibleOutlineItems: (data) => this.handleVisibleMessage(data),
      currentOutlineItem: (data) => this.handleVisibleMessage(data),
      scrollMapData: (data) => this.emitScrollmapData(data),
      ready: () => this.handleReadyMessage(),
    };
    this.pdfjsPath = path.join(__dirname, "..", "vendors", "pdfjs-dist", "web", "viewer.html");
    this.element = document.createElement("iframe");
    this.element.classList.add("pdf-viewer");
    this.element.setAttribute("tabindex", "-1");
    this.element.pdfViewerRedispatchKeyboardEvent = (event) =>
      this.redispatchKeyboardEvent(event);
    this.autoRefreshPausedByBuild = false;
    this.pendingRefresh = false;
    this.readyCallbacks = new Set();
    this.getLatexTools = null; // Getter set by main module
    this.getTypstTools = null; // Getter set by main module
    this.setFile(filePath, hash);
    this.reload();
    this.disposables.add(
      atom.config.observe("pdf-viewer.autoRefresh", (value) => {
        this.autoRefresh = value;
      }),
      atom.config.observe("pdf-viewer.autoTime", (value) => {
        this.autoTime = value;
      }),
      atom.config.observe("pdf-viewer.closeDeleted", (value) => {
        this.closeDeleted = value;
      }),
      atom.config.observe("pdf-viewer.debug", (value) => {
        this.debug = value;
      }),
      atom.commands.add(this.element, {
        "pdf-viewer:compile": () => this.compile(),
        "pdf-viewer:open-tex": () => this.openTex(),
        "pdf-viewer:refresh": () => this.refreshNow(),
        "pdf-viewer:toggle-refreshing": () => this.toggleRefreshing(),
        "pdf-viewer:invert-current": () => this.toggleInvertMode(),
        "pdf-viewer:next-page": () => this.sendCommand("next-page"),
        "pdf-viewer:previous-page": () => this.sendCommand("previous-page"),
        "pdf-viewer:first-page": () => this.sendCommand("first-page"),
        "pdf-viewer:last-page": () => this.sendCommand("last-page"),
        "pdf-viewer:scroll-up": () => this.sendCommand("scroll-up"),
        "pdf-viewer:scroll-down": () => this.sendCommand("scroll-down"),
        "pdf-viewer:scroll-left": () => this.sendCommand("scroll-left"),
        "pdf-viewer:scroll-right": () => this.sendCommand("scroll-right"),
        "pdf-viewer:page-up": () => this.sendCommand("page-up"),
        "pdf-viewer:page-down": () => this.sendCommand("page-down"),
        "pdf-viewer:zoom-in": () => this.sendCommand("zoom-in"),
        "pdf-viewer:zoom-out": () => this.sendCommand("zoom-out"),
        "pdf-viewer:zoom-reset": () => this.sendCommand("zoom-reset"),
        "pdf-viewer:rotate-clockwise": () => this.sendCommand("rotate-clockwise"),
        "pdf-viewer:rotate-counterclockwise": () => this.sendCommand("rotate-counterclockwise"),
        "pdf-viewer:select-tool": () => this.sendCommand("select-tool"),
        "pdf-viewer:hand-tool": () => this.sendCommand("hand-tool"),
        "pdf-viewer:find": () => this.sendCommand("find"),
        "pdf-viewer:find-next": () => this.sendCommand("find-next"),
        "pdf-viewer:find-previous": () => this.sendCommand("find-previous"),
        "pdf-viewer:toggle-sidebar": () => this.sendCommand("toggle-sidebar"),
        "pdf-viewer:presentation-mode": () => this.sendCommand("presentation-mode"),
        "pdf-viewer:download": () => this.sendCommand("download"),
        "pdf-viewer:print": () => this.sendCommand("print"),
        "pdf-viewer:copy": () => this.sendCommand("copy"),
      }),
    );
    this.messageEventBinded = this.messageEvent.bind(this);
    window.addEventListener("message", this.messageEventBinded);
    this.loadEventBinded = this.loadEvent.bind(this);
    this.element.addEventListener("load", this.loadEventBinded);

    // Handle focus to activate pane
    this.focusEventBinded = this.focusEvent.bind(this);
    this.element.addEventListener("focus", this.focusEventBinded);

    // Handle mousedown on tab to activate pane
    this.mousedownEventBinded = this.mousedownEvent.bind(this);
    this.element.addEventListener("mousedown", this.mousedownEventBinded);

    // Handle tab dragging - disable pointer events on iframe during drag
    // Listen at the document level to catch all drag operations
    this.dragStartBinded = this.dragStartHandler.bind(this);
    this.dragOverBinded = this.dragOverHandler.bind(this);
    this.dragEndBinded = this.dragEndHandler.bind(this);
    this.dropBinded = this.dropHandler.bind(this);

    document.addEventListener("dragstart", this.dragStartBinded, true);
    document.addEventListener("dragover", this.dragOverBinded, true);
    document.addEventListener("dragend", this.dragEndBinded, true);
    document.addEventListener("drop", this.dropBinded, true);
  }

  dragStartHandler() {
    // When any drag starts (likely a tab), disable pointer events on the iframe
    // This allows the drop zone detection to work properly
    this.element.style.pointerEvents = "none";
    this._isDragging = true;
  }

  dragOverHandler() {
    // Keep pointer events disabled during drag
    if (this._isDragging) {
      this.element.style.pointerEvents = "none";
    }
  }

  dragEndHandler() {
    // Re-enable pointer events when drag operation ends
    this.element.style.pointerEvents = "";
    this._isDragging = false;
  }

  dropHandler() {
    // Re-enable pointer events after drop
    this.element.style.pointerEvents = "";
    this._isDragging = false;
  }

  pauseAutoRefresh() {
    // Only pause if auto-refresh is currently enabled
    if (this.autoRefresh && !this.autoRefreshPausedByBuild) {
      if (this.debug) {
        console.log(
          `[pdf-viewer] Pausing auto-refresh for ${path.basename(this.filePath)} during build`,
        );
      }
      this.autoRefreshPausedByBuild = true;
      this.savedAutoRefresh = this.autoRefresh;
      this.autoRefresh = false;
    }
  }

  resumeAutoRefresh() {
    // Only resume if we had paused it
    if (this.autoRefreshPausedByBuild) {
      if (this.debug) {
        console.log(
          `[pdf-viewer] Resuming auto-refresh for ${path.basename(this.filePath)} after build`,
        );
      }
      this.autoRefreshPausedByBuild = false;
      this.autoRefresh = this.savedAutoRefresh;
      // Trigger a refresh now that the build is complete
      if (this.autoRefresh) {
        if (this.ready) {
          this.refresh();
        } else {
          // Viewer is not ready (e.g., hidden tab), schedule refresh for when it becomes ready
          if (this.debug) {
            console.log(
              `[pdf-viewer] Viewer not ready, scheduling pending refresh for ${path.basename(
                this.filePath,
              )}`,
            );
          }
          this.pendingRefresh = true;
        }
      }
    }
  }

  setFile(filePath, hash) {
    this.subscriptions.dispose();
    this.file = new File(filePath);
    this.hash = hash ? hash : "";
    this.lastFileSize = 0;
    this.fileStableTimeout = null;
    this.clearNavigationState();
    this.subscriptions.add(
      this.file.onDidChange(() => {
        if (this.autoRefresh && !this.autoRefreshPausedByBuild) {
          this.scheduleStableRefresh();
        }
      }),
      this.file.onDidDelete(() => {
        if (this.closeDeleted) {
          this.destroy();
        }
      }),
      this.file.onDidRename(() => {
        this.reload();
      }),
    );
  }

  sendMessage(data) {
    try {
      this.element.contentWindow.postMessage(data);
    } catch (err) {
      if (this.debug) {
        console.error(`pdf-viewer: Cannot send message to PDFjs: ${err}`, data);
      }
    }
  }

  get filePath() {
    return this.file.getPath();
  }

  getPath() {
    return this.filePath;
  }

  getURI() {
    return `${this.filePath}${this.hash}`;
  }

  // Called by Pulsar when the item is activated (e.g., tab clicked)
  focus() {
    this.element.focus();
    this.activatePane();
  }

  serialize() {
    return {
      deserializer: "pdf-viewer",
      filePath: this.filePath,
      hash: this.hash,
    };
  }

  copy() {
    const viewer = new Viewer(this.filePath, this.getCopyHash());
    viewer.getLatexTools = this.getLatexTools;
    viewer.getTypstTools = this.getTypstTools;
    return viewer;
  }

  getCopyHash() {
    if (!this.hash) {
      return "";
    }

    const hash = this.hash.startsWith("#") ? this.hash.slice(1) : this.hash;
    const params = hash.split("&").filter((part) => part.includes("="));
    return params.length > 0 ? `#${params.join("&")}` : "";
  }

  destroy() {
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      pane.destroyItem(this);
    }
    window.removeEventListener("message", this.messageEventBinded);
    this.element.removeEventListener("load", this.loadEventBinded);
    this.element.removeEventListener("focus", this.focusEventBinded);
    this.element.removeEventListener("mousedown", this.mousedownEventBinded);
    delete this.element.pdfViewerRedispatchKeyboardEvent;

    // Clean up drag event handlers from document
    document.removeEventListener("dragstart", this.dragStartBinded, true);
    document.removeEventListener("dragover", this.dragOverBinded, true);
    document.removeEventListener("dragend", this.dragEndBinded, true);
    document.removeEventListener("drop", this.dropBinded, true);

    // Clean up file stability timeout
    if (this.fileStableTimeout) {
      clearTimeout(this.fileStableTimeout);
      this.fileStableTimeout = null;
    }

    this.element.remove();
    this.disposables.dispose();
    this.subscriptions.dispose();
  }

  getTitle() {
    return path.basename(this.filePath);
  }

  reload() {
    this.ready = false;
    this.clearNavigationState();
    this.element.src = `${this.pdfjsPath}?file=${encodeURIComponent(this.filePath)}${this.hash}`;
    this.updateTitle();
  }

  refresh() {
    if (!this.ready) {
      return;
    }
    return setTimeout(() => {
      this.clearNavigationState();
      this.sendMessage({ type: "refresh", filePath: this.filePath });
    }, this.autoTime);
  }

  refreshNow() {
    if (!this.ready) {
      return;
    }
    this.clearNavigationState();
    this.sendMessage({ type: "refresh", filePath: this.filePath });
  }

  toggleRefreshing() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      atom.notifications.addSuccess("pdf-viewer: Auto-refreshing activated in active file");
    } else {
      atom.notifications.addSuccess("pdf-viewer: Auto-refreshing deactivated in active file");
    }
  }

  toggleInvertMode() {
    this.sendMessage({ type: "invert" });
  }

  sendCommand(command) {
    this.sendMessage({ type: "command", command });
  }

  scheduleStableRefresh() {
    // Cancel any pending stability check
    if (this.fileStableTimeout) {
      clearTimeout(this.fileStableTimeout);
      this.fileStableTimeout = null;
    }

    // Check file size and schedule refresh when stable
    this.checkFileStability();
  }

  checkFileStability() {
    try {
      const stats = fs.statSync(this.filePath);
      const currentSize = stats.size;

      if (currentSize === 0) {
        // File is empty (being rewritten), wait and check again
        if (this.debug) {
          console.log(
            `[pdf-viewer] File is empty, waiting for content: ${path.basename(this.filePath)}`,
          );
        }
        this.fileStableTimeout = setTimeout(() => this.checkFileStability(), 100);
        return;
      }

      if (currentSize !== this.lastFileSize) {
        // Size changed, file is still being written
        if (this.debug) {
          console.log(
            `[pdf-viewer] File size changed (${
              this.lastFileSize
            } -> ${currentSize}), waiting: ${path.basename(this.filePath)}`,
          );
        }
        this.lastFileSize = currentSize;
        this.fileStableTimeout = setTimeout(() => this.checkFileStability(), 200);
        return;
      }

      // Size is stable, validate PDF header before refreshing
      if (this.isPdfValid()) {
        if (this.debug) {
          console.log(
            `[pdf-viewer] File stable and valid, refreshing: ${path.basename(this.filePath)}`,
          );
        }
        this.refresh();
      } else {
        // PDF header not valid yet, wait and check again
        if (this.debug) {
          console.log(`[pdf-viewer] PDF not valid yet, waiting: ${path.basename(this.filePath)}`);
        }
        this.fileStableTimeout = setTimeout(() => this.checkFileStability(), 200);
      }
    } catch (err) {
      // File might not exist or be locked, wait and retry
      if (this.debug) {
        console.log(`[pdf-viewer] Error checking file stability: ${err.message}`);
      }
      this.fileStableTimeout = setTimeout(() => this.checkFileStability(), 200);
    }
  }

  isPdfValid() {
    try {
      // Check PDF header (%PDF-) and trailer (%%EOF)
      const fd = fs.openSync(this.filePath, "r");
      try {
        // Check header
        const headerBuffer = Buffer.alloc(8);
        fs.readSync(fd, headerBuffer, 0, 8, 0);
        const header = headerBuffer.toString("ascii");
        if (!header.startsWith("%PDF-")) {
          return false;
        }

        // Check trailer - read last 1024 bytes to find %%EOF
        const stats = fs.fstatSync(fd);
        const tailSize = Math.min(1024, stats.size);
        const tailBuffer = Buffer.alloc(tailSize);
        fs.readSync(fd, tailBuffer, 0, tailSize, stats.size - tailSize);
        const tail = tailBuffer.toString("ascii");
        if (!tail.includes("%%EOF")) {
          return false;
        }

        return true;
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      return false;
    }
  }

  onDidDispose(callback) {
    this.disposables.add(new Disposable(callback));
  }

  updateTitle() {
    this.onDidChangeTitleCallbacks.forEach((callback) => callback());
  }

  onDidChangeTitle(callback) {
    this.onDidChangeTitleCallbacks.add(callback);
    return new Disposable(() => {
      this.onDidChangeTitleCallbacks.delete(callback);
    });
  }

  observeOutline(callback) {
    if (this.outlineLoaded) {
      callback(this.outline);
    }
    this.observeOutlineCallbacks.add(callback);
    return new Disposable(() => {
      this.observeOutlineCallbacks.delete(callback);
    });
  }

  observeVisible(callback) {
    if (this.visibleDestHashes) {
      callback(this.visibleDestHashes);
    }
    this.observeVisibleCallbacks.add(callback);
    return new Disposable(() => {
      this.observeVisibleCallbacks.delete(callback);
    });
  }

  observeScrollMapData(callback) {
    if (this.scrollMapData) {
      callback(this.scrollMapData);
    }
    this.observeScrollMapDataCallbacks.add(callback);
    return new Disposable(() => {
      this.observeScrollMapDataCallbacks.delete(callback);
    });
  }

  handleKeydown(data) {
    if (this.debug) {
      console.log("[pdf-viewer] handleKeydown received:", data.keystroke || data.action);
    }

    if (data.action) {
      atom.commands.dispatch(this.element, data.action);
      return true;
    }
    return false;
  }

  redispatchKeyboardEvent(originalEvent) {
    const event = new KeyboardEvent(originalEvent.type, {
      bubbles: true,
      cancelable: true,
      key: originalEvent.key,
      code: originalEvent.code,
      location: originalEvent.location,
      ctrlKey: originalEvent.ctrlKey,
      shiftKey: originalEvent.shiftKey,
      altKey: originalEvent.altKey,
      metaKey: originalEvent.metaKey,
      repeat: originalEvent.repeat,
      isComposing: originalEvent.isComposing,
    });
    this.element.dispatchEvent(event);
    return event.defaultPrevented;
  }

  async handleSynctex(data) {
    const latexTools = this.getLatexTools?.();
    if (!latexTools?.syncToSource) {
      if (this.debug) {
        console.error("pdf-viewer: latex-tools not available for synctex");
      }
      return;
    }

    const result = await latexTools.syncToSource(this.filePath, data.pageNo, data.x, data.y);

    if (!result || !result.file) {
      return;
    }

    if (!fs.existsSync(result.file)) {
      if (this.debug) {
        console.error(`pdf-viewer: cannot open "${result.file}", file does not exist`);
      }
      return;
    }

    atom.workspace.open(result.file, {
      split: "left",
      initialLine: result.line - 1,
      initialColumn: result.column,
      searchAllPanes: true,
    });
  }

  /**
   * Triggers compilation for this PDF's source file.
   * Tries .typ (typst-tools) first, then .tex (latex-tools).
   */
  compile() {
    // Try Typst source first
    const typFile = this.filePath.replace(/\.pdf$/, ".typ");
    if (fs.existsSync(typFile)) {
      const typstTools = this.getTypstTools?.();
      if (typstTools?.compile) {
        // Save .typ file if open and modified
        for (const editor of atom.workspace.getTextEditors()) {
          if (editor.getPath() === typFile && editor.isModified()) {
            editor.save();
            break;
          }
        }
        if (this.debug) {
          console.log(`[pdf-viewer] Compiling ${path.basename(typFile)}`);
        }
        typstTools.compile(typFile);
        return;
      }
    }

    // Fall back to LaTeX source
    const texFile = this.filePath.replace(/\.pdf$/, ".tex");
    if (!fs.existsSync(texFile)) {
      if (this.debug) {
        console.log(`[pdf-viewer] No source file found for ${path.basename(this.filePath)}`);
      }
      atom.notifications.addWarning(
        `pdf-viewer: No source file found for ${path.basename(this.filePath)}`,
      );
      return;
    }

    const latexTools = this.getLatexTools?.();
    if (!latexTools?.compile) {
      if (this.debug) {
        console.log("[pdf-viewer] latex-tools not available");
      }
      atom.notifications.addWarning("pdf-viewer: latex-tools not available");
      return;
    }

    // Save .tex file if open and modified
    for (const editor of atom.workspace.getTextEditors()) {
      if (editor.getPath() === texFile && editor.isModified()) {
        editor.save();
        break;
      }
    }

    if (this.debug) {
      console.log(`[pdf-viewer] Compiling ${path.basename(texFile)}`);
    }
    latexTools.compile(texFile);
  }

  /**
   * Opens the corresponding source file (.typ or .tex).
   */
  openTex() {
    // Try .typ first, then .tex
    const typFile = this.filePath.replace(/\.pdf$/, ".typ");
    if (fs.existsSync(typFile)) {
      if (this.debug) {
        console.log(`[pdf-viewer] Opening ${path.basename(typFile)}`);
      }
      atom.workspace.open(typFile, { split: "left", searchAllPanes: true });
      return;
    }

    const texFile = this.filePath.replace(/\.pdf$/, ".tex");
    if (!fs.existsSync(texFile)) {
      if (this.debug) {
        console.log(`[pdf-viewer] No source file found for ${path.basename(this.filePath)}`);
      }
      atom.notifications.addWarning(
        `pdf-viewer: No source file found for ${path.basename(this.filePath)}`,
      );
      return;
    }

    if (this.debug) {
      console.log(`[pdf-viewer] Opening ${path.basename(texFile)}`);
    }
    atom.workspace.open(texFile, { split: "left", searchAllPanes: true });
  }

  scrollToPosition(page, x, y) {
    this.sendMessage({ type: "setposition", page: page, x: x, y: y });
  }

  scrollToDestination(item) {
    this.sendMessage({ type: "setdestination", dest: item.dest });
    this.visibleDestHashes = item.destHash;
    this.observeVisibleCallbacks.forEach((callback) => callback(this.visibleDestHashes));
  }

  currentdest() {
    this.sendMessage({ type: "currentdest" });
  }

  activatePane() {
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      pane.activate();
      pane.activateItem(this);
    }
  }

  focusEvent() {
    this.activatePane();
  }

  mousedownEvent() {
    // Focus the element when clicked to ensure pane activation
    this.element.focus();
  }

  messageEvent(message) {
    if (message.source !== this.element.contentWindow) {
      return;
    }

    const data = message.data;
    const handler = this.messageHandlers[data?.type];
    if (handler) {
      return handler(data);
    }
  }

  handleClickMessage() {
    this.element.focus();
    this.activatePane();
    this.currentdest();
  }

  handleOutlineMessage(data) {
    this.outlineLoaded = true;
    this.outline = data.outline;
    this.observeOutlineCallbacks.forEach((callback) => callback(this.outline));
  }

  handleVisibleMessage(data) {
    this.visibleDestHashes = data.destHash;
    this.observeVisibleCallbacks.forEach((callback) => callback(this.visibleDestHashes));
  }

  handleReadyMessage() {
    this.ready = true;
    this.readyCallbacks.forEach((resolve) => resolve());
    this.readyCallbacks.clear();

    if (this.pendingRefresh) {
      if (this.debug) {
        console.log(
          `[pdf-viewer] Viewer now ready, executing pending refresh for ${path.basename(
            this.filePath,
          )}`,
        );
      }
      this.pendingRefresh = false;
      this.refresh();
    }
  }

  /**
   * Returns a promise that resolves when the viewer is ready.
   */
  whenReady() {
    if (this.ready) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.readyCallbacks.add(resolve);
    });
  }

  clearNavigationState() {
    this.outlineLoaded = false;
    this.outline = null;
    this.visibleDestHashes = null;
    this.scrollMapData = null;
    this.observeOutlineCallbacks.forEach((callback) => callback(this.outline));
    this.observeVisibleCallbacks.forEach((callback) => callback(this.visibleDestHashes));
    this.observeScrollMapDataCallbacks.forEach((callback) => callback(this.scrollMapData));
  }

  loadEvent() {
    this.disposables.add(
      atom.config.observe("pdf-viewer.invertMode", (value) => {
        this.sendMessage({ type: "invert", initial: value });
      }),
    );
  }

  /**
   * Emits scrollmap data to observers.
   * @param {Object} data - Scrollmap data from iframe
   */
  emitScrollmapData(data) {
    this.scrollMapData = data;
    this.observeScrollMapDataCallbacks.forEach((callback) => callback(data));
  }
};
