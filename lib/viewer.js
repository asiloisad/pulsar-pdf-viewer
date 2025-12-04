const { CompositeDisposable, Disposable, File } = require("atom");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

module.exports = class Viewer {
  constructor(filePath, hash) {
    this.disposables = new CompositeDisposable();
    this.subscriptions = new CompositeDisposable();
    this.onDidChangeTitleCallbacks = new Set();
    this.observeOutlineCallbacks = new Set();
    this.observeCurrentCallbacks = new Set();
    this.pdfjsPath = path.join(
      __dirname,
      "..",
      "vendors",
      this.getVendor(),
      "web",
      "viewer.html"
    );
    this.element = document.createElement("iframe");
    this.element.classList.add("pdf-viewer");
    this.element.setAttribute("tabindex", "-1");
    this.autoRefreshPausedByBuild = false;
    this.pendingRefresh = false;
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
      })
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

  dragStartHandler(event) {
    // When any drag starts (likely a tab), disable pointer events on the iframe
    // This allows the drop zone detection to work properly
    this.element.style.pointerEvents = "none";
    this._isDragging = true;
  }

  dragOverHandler(event) {
    // Keep pointer events disabled during drag
    if (this._isDragging) {
      this.element.style.pointerEvents = "none";
    }
  }

  dragEndHandler(event) {
    // Re-enable pointer events when drag operation ends
    this.element.style.pointerEvents = "";
    this._isDragging = false;
  }

  dropHandler(event) {
    // Re-enable pointer events after drop
    this.element.style.pointerEvents = "";
    this._isDragging = false;
  }

  pauseAutoRefresh() {
    // Only pause if auto-refresh is currently enabled
    if (this.autoRefresh && !this.autoRefreshPausedByBuild) {
      if (this.debug) {
        console.log(
          `[pdf-viewer] Pausing auto-refresh for ${path.basename(
            this.filePath
          )} during build`
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
          `[pdf-viewer] Resuming auto-refresh for ${path.basename(
            this.filePath
          )} after build`
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
                this.filePath
              )}`
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
      })
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

  getVendor() {
    return "pdfjs-5.4.394-dist";
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

  destroy() {
    let pane = atom.workspace.paneForItem(this);
    if (pane) {
      pane.destroyItem(this);
    }
    window.removeEventListener("message", this.messageEventBinded);
    this.element.removeEventListener("load", this.loadEventBinded);
    this.element.removeEventListener("focus", this.focusEventBinded);
    this.element.removeEventListener("mousedown", this.mousedownEventBinded);

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

    // Clean up scroll-map
    this.disableScrollMap();

    this.element.remove();
    this.disposables.dispose();
    this.subscriptions.dispose();
  }

  getTitle() {
    return path.basename(this.filePath);
  }

  reload() {
    this.ready = false;
    this.element.src = `${this.pdfjsPath}?file=${encodeURIComponent(
      this.filePath
    )}${this.hash}`;
    this.updateTitle();
  }

  refresh() {
    if (!this.ready) {
      return;
    }
    return setTimeout(() => {
      this.sendMessage({ type: "refresh", filePath: this.filePath });
    }, this.autoTime);
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
            `[pdf-viewer] File is empty, waiting for content: ${path.basename(
              this.filePath
            )}`
          );
        }
        this.fileStableTimeout = setTimeout(
          () => this.checkFileStability(),
          100
        );
        return;
      }

      if (currentSize !== this.lastFileSize) {
        // Size changed, file is still being written
        if (this.debug) {
          console.log(
            `[pdf-viewer] File size changed (${
              this.lastFileSize
            } -> ${currentSize}), waiting: ${path.basename(this.filePath)}`
          );
        }
        this.lastFileSize = currentSize;
        this.fileStableTimeout = setTimeout(
          () => this.checkFileStability(),
          200
        );
        return;
      }

      // Size is stable, validate PDF header before refreshing
      if (this.isPdfValid()) {
        if (this.debug) {
          console.log(
            `[pdf-viewer] File stable and valid, refreshing: ${path.basename(
              this.filePath
            )}`
          );
        }
        this.refresh();
      } else {
        // PDF header not valid yet, wait and check again
        if (this.debug) {
          console.log(
            `[pdf-viewer] PDF not valid yet, waiting: ${path.basename(
              this.filePath
            )}`
          );
        }
        this.fileStableTimeout = setTimeout(
          () => this.checkFileStability(),
          200
        );
      }
    } catch (err) {
      // File might not exist or be locked, wait and retry
      if (this.debug) {
        console.log(
          `[pdf-viewer] Error checking file stability: ${err.message}`
        );
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
    if (this.outline) {
      callback(this.outline);
    }
    this.observeOutlineCallbacks.add(callback);
    return new Disposable(() => {
      this.observeOutlineCallbacks.delete(callback);
    });
  }

  observeCurrent(callback) {
    if (this.destHash) {
      callback(this.destHash);
    }
    this.observeCurrentCallbacks.add(callback);
    return new Disposable(() => {
      this.observeCurrentCallbacks.delete(callback);
    });
  }

  handleKeydown(data) {
    if (this.debug) {
      console.log("[pdf-viewer] handleKeydown received:", data.action);
    }
    if (data.action === "command-palette:toggle") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "command-palette:toggle"
      );
    } else if (data.action === "navigation-panel:toggle") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "navigation-panel:toggle"
      );
    } else if (data.action === "fuzzy-finder:toggle-file-finder") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "fuzzy-finder:toggle-file-finder"
      );
    } else if (data.action === "open-external:open") {
      atom.commands.dispatch(atom.views.getView(this), "open-external:open");
    } else if (data.action === "open-external:show") {
      atom.commands.dispatch(atom.views.getView(this), "open-external:show");
      // } else if (data.action==='project-list:recent') {
      //   atom.commands.dispatch(atom.views.getView(atom.workspace), "project-list:recent")
      // } else if (data.action==='project-list:toggle') {
      //   atom.commands.dispatch(atom.views.getView(atom.workspace), "project-list:toggle")
    } else if (data.action === "toggle-refreshing") {
      this.autoRefresh = !this.autoRefresh;
      if (this.autoRefresh) {
        atom.notifications.addSuccess(
          "pdf-viewer: Auto-refreshing activated in active file"
        );
      } else {
        atom.notifications.addSuccess(
          "pdf-viewer: Auto-refreshing deactivated in active file"
        );
      }
    } else if (data.action === "window:focus-pane-on-left") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "window:focus-pane-on-left"
      );
    } else if (data.action === "window:focus-pane-above") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "window:focus-pane-above"
      );
    } else if (data.action === "window:focus-pane-on-right") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "window:focus-pane-on-right"
      );
    } else if (data.action === "window:focus-pane-below") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "window:focus-pane-below"
      );
    } else if (data.action === "window:reload") {
      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        "window:reload"
      );
    } else if (data.action === "pdf-viewer:compile") {
      atom.commands.dispatch(this.element, "pdf-viewer:compile");
    } else if (data.action === "pdf-viewer:open-tex") {
      atom.commands.dispatch(this.element, "pdf-viewer:open-tex");
    }
  }

  handleSynctex(data) {
    let syncexe = atom.config.get("pdf-viewer.synctexPath");
    let cmd = `"${syncexe}" edit -o "${data.pageNo}:${data.x}:${data.y}:${this.filePath}"`;
    cp.exec(cmd, (err, stdout, stderr) => {
      if (err && this.debug) {
        return console.error(`pdf-viewer: synctex error: ${stderr}`);
      }
      let synctex = {};
      for (let line of stdout.split(/\r?\n/g)) {
        if (line.startsWith("Input:")) {
          synctex.input = line.substr(6);
        } else if (line.startsWith("Line:")) {
          let value = line.substr(5);
          synctex.line = parseInt(value, 10) - 1;
        } else if (line.startsWith("Column:")) {
          let value = line.substr(7);
          synctex.column = parseInt(value, 10);
        }
      }
      if (!synctex.input) {
        if (this.debug) {
          return console.error(`pdf-viewer: synctex stdout parsed with errors`);
        }
      } else if (!fs.existsSync(synctex.input)) {
        if (this.debug) {
          return console.error(
            `pdf-viewer: cannot open synctex input "${synctex.input}", because it does not exists`
          );
        }
      } else {
        atom.workspace.open(synctex.input, {
          split: "left",
          initialLine: synctex.line,
          initialColumn: synctex.column,
          searchAllPanes: true,
        });
      }
    });
  }

  scrollToPosition(page, x, y) {
    this.sendMessage({ type: "setposition", page: page, x: x, y: y });
  }

  scrollToDestination(item) {
    this.sendMessage({ type: "setdestination", dest: item.dest });
    this.destHash = item.destHash;
    this.observeCurrentCallbacks.forEach((callback) => callback(this.destHash));
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
    } else if (message.data.type === "click") {
      this.element.focus();
      this.activatePane();
      this.currentdest();
    } else if (message.data.type === "keydown") {
      return this.handleKeydown(message.data);
    } else if (message.data.type === "contextmenu") {
      return this.handleSynctex(message.data);
    } else if (message.data.type === "pdfjsOutline") {
      this.outline = message.data.outline;
      this.observeOutlineCallbacks.forEach((callback) =>
        callback(this.outline)
      );
    } else if (message.data.type === "currentOutlineItem") {
      this.destHash = message.data.destHash;
      this.observeCurrentCallbacks.forEach((callback) =>
        callback(this.destHash)
      );
    } else if (message.data.type === "scrollMapData") {
      this.updateScrollMap(message.data);
    } else if (message.data.type === "ready") {
      this.ready = true;
      // Check if there's a pending refresh from a build that finished while we were not ready
      if (this.pendingRefresh) {
        if (this.debug) {
          console.log(
            `[pdf-viewer] Viewer now ready, executing pending refresh for ${path.basename(
              this.filePath
            )}`
          );
        }
        this.pendingRefresh = false;
        this.refresh();
      }
    }
  }

  loadEvent() {
    this.disposables.add(
      atom.config.observe("pdf-viewer.invertMode", (value) => {
        this.sendMessage({ type: "invert", initial: value });
      })
    );
  }

  /**
   * Enables scroll-map for this viewer.
   * @param {Object} service - The scroll-map service
   */
  enableScrollMap(service) {
    if (this.scrollMap) {
      return; // Already enabled
    }
    if (!service.ScrollMapSimple) {
      return; // Service doesn't support simple scroll-map
    }
    this.scrollMapService = service;
    // Defer insertion until element is in DOM
    this.tryInsertScrollMap();
  }

  /**
   * Attempts to insert scroll-map into DOM.
   * Called when service is ready and when element is added to DOM.
   */
  tryInsertScrollMap() {
    if (this.scrollMap || !this.scrollMapService) {
      return;
    }
    if (!this.element.parentNode) {
      // Element not in DOM yet, try again after a short delay
      requestAnimationFrame(() => this.tryInsertScrollMap());
      return;
    }
    this.scrollMap = new this.scrollMapService.ScrollMapSimple();
    this.element.parentNode.insertBefore(
      this.scrollMap.element,
      this.element.nextSibling
    );
    if (this.debug) {
      console.log("[pdf-viewer] scroll-map inserted into DOM");
    }
  }

  /**
   * Disables scroll-map for this viewer.
   */
  disableScrollMap() {
    this.scrollMapService = null;
    if (this.scrollMap) {
      this.scrollMap.destroy();
      this.scrollMap = null;
    }
  }

  /**
   * Updates scroll-map markers from iframe data.
   * @param {Object} data - Scroll map data from iframe
   */
  updateScrollMap(data) {
    if (!this.scrollMap) {
      if (this.debug) {
        console.log("[pdf-viewer] scrollMapData received but scrollMap not ready");
      }
      return;
    }
    const threshold = atom.config.get("pdf-viewer.scrollMapThreshold");
    if (threshold && threshold < data.items.length) {
      if (this.debug) {
        console.log("[pdf-viewer] scrollMapData exceeds threshold:", data.items.length, ">", threshold);
      }
      this.scrollMap.setItems([]);
      return;
    }
    if (this.debug) {
      console.log("[pdf-viewer] scrollMapData:", data.items.length, "items");
    }
    const items = data.items.map((item) => {
      // Use level for different styling (level 0 = h1, level 1 = h2, etc.)
      let cls = item.isCurrent ? "pdf-current" : `pdf-h${Math.min(item.level + 1, 6)}`;
      return {
        percent: item.percent,
        cls,
        click: () => this.scrollToPosition(item.page, item.x, item.y),
      };
    });
    this.scrollMap.setItems(items);
  }
};
