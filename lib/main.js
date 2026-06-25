const { CompositeDisposable, Disposable } = require("atom");
const Viewer = require("./viewer");
const path = require("path");
const fs = require("fs");

/**
 * PDF Viewer Package
 * Provides PDF viewing capabilities with SyncTeX support for LaTeX integration.
 * Supports auto-refresh, invert mode, and integration with latex-tools.
 */
module.exports = {
  /**
   * Activates the package and registers the PDF opener.
   */
  activate() {
    if (!this.active) {
      this.active = true;
    } else {
      return;
    }
    this.prepareCSS();
    this.viewers = new Set();
    this.viewerObservers = new Set();
    this.SimplemapClass = null;
    this.outlineScrollmap = null;
    this.latexTools = null;
    this.latexToolsSubscriptions = null;
    this.typstTools = null;
    this.typstToolsSubscriptions = null;
    this.disposables = new CompositeDisposable(
      atom.workspace.addOpener((uri) => {
        const match = uri.match(/(.+\.pdf)($|#.*)/i);
        if (match) {
          return this.createViewer(match[1], match[2]);
        }
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        this.prepareCSS();
        this.reloadAll();
      }),
      atom.commands.add("atom-workspace", {
        "pdf-viewer:reload-all": () => this.reloadAll(),
        "pdf-viewer:invert-mode": () => {
          atom.config.set("pdf-viewer.invertMode", !atom.config.get("pdf-viewer.invertMode"));
        },
      }),
    );
  },

  /**
   * Deactivates the package and destroys all viewers.
   */
  deactivate() {
    this.active = false;
    this.destroyOutlineScrollmap();
    for (let viewer of this.viewers) {
      viewer.destroy();
    }
    this.disposables.dispose();
    if (this.latexToolsSubscriptions) {
      this.latexToolsSubscriptions.dispose();
    }
    if (this.typstToolsSubscriptions) {
      this.typstToolsSubscriptions.dispose();
    }
    this.SimplemapClass = null;
  },

  /**
   * Deserializes a viewer from saved state.
   * @param {Object} state - The serialized state
   * @returns {Viewer|undefined} The restored viewer or undefined
   */
  deserialize(state) {
    if (!fs.existsSync(state.filePath)) {
      return;
    }
    this.activate(); // prevent multiple activation
    return this.createViewer(state.filePath, state.hash);
  },

  /**
   * Creates a new PDF viewer instance.
   * @param {string} filePath - Path to the PDF file
   * @param {string} hash - URL hash for page/position
   * @returns {Viewer} The new viewer instance
   */
  createViewer(filePath, hash) {
    let viewer = new Viewer(filePath, hash);
    viewer.getLatexTools = () => this.latexTools; // Getter for latex-tools service
    viewer.getTypstTools = () => this.typstTools; // Getter for typst-tools service
    this.viewers.add(viewer);
    viewer.onDidDispose(() => {
      this.viewers.delete(viewer);
      this.outlineScrollmap?.removeViewer(viewer);
    });
    this.outlineScrollmap?.addViewer(viewer);
    this.viewerObservers.forEach((callback) => callback(viewer));
    return viewer;
  },

  consumeSimpleMap(SimplemapClass) {
    const PdfScrollmap = require("./scrollmap");
    this.SimplemapClass = SimplemapClass;
    this.destroyOutlineScrollmap();
    this.outlineScrollmap = new PdfScrollmap(this, SimplemapClass);
    return new Disposable(() => {
      if (this.SimplemapClass === SimplemapClass) {
        this.destroyOutlineScrollmap();
        this.SimplemapClass = null;
      }
    });
  },

  destroyOutlineScrollmap() {
    this.outlineScrollmap?.destroy();
    this.outlineScrollmap = null;
  },

  provideNavigationAdapter() {
    return {
      handlesItem: (item) => "pdfjsPath" in item,
      observeHeaders: (item, callback) => {
        item._navigationHeaders = null;
        item._navigationVisibleDestHashes = [];
        const snoFilter = atom.config.get("pdf-viewer.snoFilter");

        const emit = (options) => {
          if (!item._navigationHeaders) return;
          markOutlineState(item._navigationHeaders, item._navigationVisibleDestHashes);
          callback(item._navigationHeaders, options);
        };

        const outlineDispose = item.observeOutline((outline) => {
          item._navigationHeaders = enrichOutline(outline, item, snoFilter);
          emit({ instant: true });
        });

        let startup = true;
        let previousKey = "";
        const visibleDispose = item.observeVisible((destHashes) => {
          const hashes = Array.isArray(destHashes) ? destHashes : [destHashes];
          const key = hashes.filter(Boolean).join("\0");
          if (!startup && key === previousKey) return;
          startup = false;
          previousKey = key;
          item._navigationVisibleDestHashes = hashes;
          emit();
        });

        return new CompositeDisposable(outlineDispose, visibleDispose);
      },
      navigateTo: (item, header) => {
        item.scrollToDestination(header);
        atom.views.getView(item).focus();
      },
    };
  },

  /**
   * Provides the pdf-viewer service for other packages.
   * @returns {Object} Service object with viewer management methods
   */
  provideViewer() {
    return {
      hasIntegratedScrollmap: true,

      /**
       * Get all active viewers
       * @returns {Set<Viewer>} Set of active viewer instances
       */
      getViewers: () => this.viewers,

      /**
       * Observe viewers - calls callback for existing and new viewers
       * @param {Function} callback - Called with each viewer
       * @returns {Disposable} Disposable to stop observing
       */
      observeViewers: (callback) => {
        for (const viewer of this.viewers) {
          callback(viewer);
        }
        this.viewerObservers.add(callback);
        return new Disposable(() => {
          this.viewerObservers.delete(callback);
        });
      },

      /**
       * Find a viewer by file path
       * @param {string} filePath - The PDF file path
       * @returns {Viewer|null} The viewer or null
       */
      getViewerByPath: (filePath) => {
        for (const viewer of this.viewers) {
          if (viewer.filePath === filePath) {
            return viewer;
          }
        }
        return null;
      },

      /**
       * Find a viewer by tag in hash
       * @param {string} tag - Tag to search for in viewer hash
       * @returns {Viewer|null} The viewer or null
       */
      getViewerByTag: (tag) => {
        for (const viewer of this.viewers) {
          if (viewer.hash && viewer.hash.includes(tag)) {
            return viewer;
          }
        }
        return null;
      },

      /**
       * Open a PDF file in the viewer
       * @param {string} filePath - Path to the PDF file
       * @param {Object} options - Options for opening
       * @param {string} options.dest - Named destination to scroll to
       * @param {string} options.tag - Tag to identify the viewer
       * @param {string} options.split - Split direction ('left', 'right', 'up', 'down')
       * @param {boolean} options.activatePane - Whether to activate the pane
       * @returns {Promise<Viewer>} The viewer instance
       */
      open: (filePath, options = {}) => {
        const { dest, tag, split = "right", activatePane = false } = options;
        let hash = "";
        if (dest) {
          hash += `#nameddest=${dest}`;
        }
        if (tag) {
          hash += hash ? `&${tag}` : `#${tag}`;
        }
        return atom.workspace.open(`${filePath}${hash}`, {
          split,
          activatePane,
          searchAllPanes: true,
        });
      },

      /**
       * Scroll an existing viewer to a named destination
       * @param {Viewer} viewer - The viewer instance
       * @param {string} dest - Named destination
       */
      scrollToDestination: (viewer, dest) => {
        if (viewer && dest) {
          viewer.scrollToDestination({ dest, destHash: `#${dest}` });
        }
      },

      /**
       * Update a viewer to show a different file
       * @param {Viewer} viewer - The viewer instance
       * @param {string} filePath - New PDF file path
       * @param {string} dest - Optional named destination
       * @param {string} tag - Optional tag
       */
      setFile: (viewer, filePath, dest, tag) => {
        if (!viewer) return;
        let hash = "";
        if (dest) {
          hash += `#nameddest=${dest}`;
        }
        if (tag) {
          hash += hash ? `&${tag}` : `#${tag}`;
        }
        viewer.setFile(filePath, hash);
        viewer.reload();
      },
    };
  },

  /**
   * Consumes the latex-tools build status service.
   * @param {Object} service - The build status service
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeLatexTools(service) {
    if (atom.config.get("pdf-viewer.debug")) {
      console.log("[pdf-viewer] Consuming build status service");
    }
    this.latexTools = service;
    this.latexToolsSubscriptions = new CompositeDisposable();

    // Subscribe to build events
    this.latexToolsSubscriptions.add(
      service.onDidStartBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build started:", data.file);
        }
        this.handleBuildStart(data.file);
      }),
      service.onDidFinishBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build finished:", data.file);
        }
        this.handleBuildFinish(data.file);
      }),
      service.onDidFailBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Build failed:", data.file);
        }
        this.handleBuildFinish(data.file);
      }),
    );

    return new Disposable(() => {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log("[pdf-viewer] Disposing build status service");
      }
      this.latexTools = null;
      if (this.latexToolsSubscriptions) {
        this.latexToolsSubscriptions.dispose();
        this.latexToolsSubscriptions = null;
      }
    });
  },

  /**
   * Consumes the typst-tools build status service.
   * @param {Object} service - The build status service
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeTypstTools(service) {
    if (atom.config.get("pdf-viewer.debug")) {
      console.log("[pdf-viewer] Consuming typst-tools build status service");
    }
    this.typstTools = service;
    this.typstToolsSubscriptions = new CompositeDisposable();

    this.typstToolsSubscriptions.add(
      service.onDidStartBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Typst build started:", data.file);
        }
        this.handleBuildStart(data.file, ".typ");
      }),
      service.onDidFinishBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Typst build finished:", data.file);
        }
        this.handleBuildFinish(data.file, ".typ");
      }),
      service.onDidFailBuild((data) => {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log("[pdf-viewer] Typst build failed:", data.file);
        }
        this.handleBuildFinish(data.file, ".typ");
      }),
    );

    return new Disposable(() => {
      if (atom.config.get("pdf-viewer.debug")) {
        console.log("[pdf-viewer] Disposing typst-tools build status service");
      }
      this.typstTools = null;
      if (this.typstToolsSubscriptions) {
        this.typstToolsSubscriptions.dispose();
        this.typstToolsSubscriptions = null;
      }
    });
  },

  /**
   * Handles build start by pausing auto-refresh.
   * @param {string} sourceFile - Path to the source file being compiled
   * @param {string} sourceExt - Source file extension (e.g., '.tex', '.typ')
   */
  handleBuildStart(sourceFile, sourceExt = ".tex") {
    const pdfFile = sourceFile.replace(new RegExp("\\" + sourceExt + "$"), ".pdf");

    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log(`[pdf-viewer] Pausing auto-refresh for ${path.basename(pdfFile)}`);
        }
        viewer.pauseAutoRefresh();
      }
    }
  },

  /**
   * Handles build finish by resuming auto-refresh.
   * @param {string} sourceFile - Path to the source file that was compiled
   * @param {string} sourceExt - Source file extension (e.g., '.tex', '.typ')
   */
  handleBuildFinish(sourceFile, sourceExt = ".tex") {
    const pdfFile = sourceFile.replace(new RegExp("\\" + sourceExt + "$"), ".pdf");

    for (let viewer of this.viewers) {
      if (viewer.filePath === pdfFile) {
        if (atom.config.get("pdf-viewer.debug")) {
          console.log(`[pdf-viewer] Resuming auto-refresh for ${path.basename(pdfFile)}`);
        }
        viewer.resumeAutoRefresh();
      }
    }
  },

  /**
   * Compiles LESS styles to CSS for the PDF viewer.
   */
  prepareCSS() {
    let lessPath = path.join(__dirname, "..", "vendors", "custom", "viewer.less");
    let cssPath = path.join(__dirname, "..", "vendors", "custom", "viewer.css");
    let css = atom.themes.loadLessStylesheet(lessPath);
    fs.writeFileSync(cssPath, css);
  },

  /**
   * Reloads all open PDF viewers.
   */
  reloadAll() {
    for (let viewer of this.viewers) {
      viewer.reload();
    }
  },
};

function enrichOutline(outline, viewer, snoFilter) {
  let index = 0;
  function parse(data, revel) {
    for (const item of data) {
      item.text = snoFilter ? item.title.replace(/[\d.]+ (.+)/g, "$1") : item.title;
      item.children = item.items;
      item.classList = [];
      item.level = item.revel = revel;
      item.startPoint = { row: index++ };
      Object.defineProperty(item, "badge", {
        get: () => (item.resolvedDest?.pageIndex != null ? item.resolvedDest.pageIndex + 1 : null),
        enumerable: true,
        configurable: true,
      });
      parse(item.children, revel + 1);
    }
  }
  parse(outline || [], 1);
  return outline || [];
}

function markOutlineState(headers, visibleDestHashes) {
  const visible = new Set((visibleDestHashes || []).filter(Boolean));

  function visit(items) {
    let hasVisible = false;
    for (const item of items) {
      const selfVisible = visible.has(item.destHash);
      const childVisible = visit(item.children || []);
      item.visibility = selfVisible ? 1 : 0;
      item.currentCount = 0;
      item.stackCount = 0;
      hasVisible = hasVisible || selfVisible || childVisible;
    }
    return hasVisible;
  }

  visit(headers || []);
}
