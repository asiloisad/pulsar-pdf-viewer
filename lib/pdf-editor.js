"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfEditor = void 0;
const fs = require("fs");
const path = require("path");
const atom_1 = require("atom");
const pdf_editor_view_1 = require("./pdf-editor-view");
class PdfEditor {
    constructor(filePath, params) {
        this.file = new atom_1.File(filePath);
        this.fileSubscriptions = new atom_1.CompositeDisposable();
        this.params = params;
        this.view = new pdf_editor_view_1.PdfEditorView(this);
        this.onDidChangeTitleCallbacks = new Set();
        this.autoReload = true;
        this.subscriptions = new atom_1.CompositeDisposable();
        this.subscribeToFile();
    }
    static deserialize({ filePath }) {
        let isFile = false;
        try {
            isFile = fs.statSync(filePath).isFile();
        }
        catch (e) { }
        if (isFile) {
            return new PdfEditor(filePath, '');
        }
        else {
            console.warn(`Could not deserialise PDF view for path ${filePath} because that file no longer exists`);
        }
    }
    subscribeToFile() {
        let timerID;
        const debounced = (callback) => {
            clearTimeout(timerID);
            timerID = setTimeout(callback, atom.config.get("pdf-viewer.autoreloadDebounce"));
        };
        this.fileSubscriptions.add(this.file.onDidRename(() => {
            this.updateTitle();
        }), this.file.onDidChange(() => {
            if (this.autoReload) {
                debounced(() => {
                    this.view.update();
                });
            }
        }), this.file.onDidDelete(() => {
            if (atom.config.get("pdf-viewer.closeViewWhenFileDeleted")) {
                try {
                    this.destroy();
                }
                catch (e) {
                    console.warn(`Could not destroy pane after external file was deleted: ${e}`);
                }
            }
        }));
    }
    get element() {
        return this.view.element;
    }
    serialize() {
        return {
            filePath: this.getPath(),
            deserializer: this.constructor.name,
        };
    }
    destroy() {
        this.subscriptions.dispose();
        this.view.destroy();
        const pane = atom.workspace.paneForItem(this);
        if (pane) {
            pane.destroyItem(this);
        }
    }
    onDidDispose(cb) {
        this.subscriptions.add(new atom_1.Disposable(cb));
    }
    getPath() {
        return this.file.getPath();
    }
    getUri() {
        return this.getURI();
    }
    getURI() {
        return this.getPath();
    }
    getTitle() {
        const filePath = this.getPath();
        return filePath ? path.basename(filePath) : "untitled";
    }
    updateTitle() {
        this.onDidChangeTitleCallbacks.forEach(cb => cb());
    }
    onDidChangeTitle(cb) {
        this.onDidChangeTitleCallbacks.add(cb);
        return new atom_1.Disposable(() => {
            this.onDidChangeTitleCallbacks.delete(cb);
        });
    }
    isEqual(other) {
        return other instanceof PdfEditor && this.getURI() === other.getURI();
    }
    onDidInteract(cb) {
        return this.view.events.on("click", (click) => {
            if (click.ctrlKey) {
                cb(click);
            }
        });
    }
    onDidClick(cb) {
        return this.view.events.on("click", cb);
    }
    onDidDoubleClick(cb) {
        return this.view.events.on("dblclick", cb);
    }
    scrollToPosition(pos, options) {
        this.view.scrollToPosition(pos, options);
    }
    setAutoReload(enabled) {
        this.autoReload = enabled;
    }
    reload(uri) {
        if (uri && uri !== this.getURI()) {
            this.fileSubscriptions.dispose();
            this.fileSubscriptions = new atom_1.CompositeDisposable();
            this.file = new atom_1.File(uri);
            this.subscribeToFile();
        }
        this.view.update();
    }
}
exports.PdfEditor = PdfEditor;
