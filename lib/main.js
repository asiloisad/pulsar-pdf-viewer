"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const pdf_editor_1 = require("./pdf-editor");
const pfdview_consumer_synctex_1 = require("./pfdview-consumer-synctex");
class PdfViewPackage {
    constructor() {
        this.subscriptions = new atom_1.CompositeDisposable();
        this.pdfExtensions = new Set();
        this.openSubscriptions = new Set();
        this.editors = new Set();
    }
    activate() {
        this.subscriptions.add(atom.workspace.addOpener(uri => {
            let match;
            if (match = uri.match(/(.+\.pdf)(#.*)?/i)) {
                const editor = new pdf_editor_1.PdfEditor(match[1], match[2]);
                this.subscribeToEditor(editor);
                return editor;
            }
        }), atom.config.observe("pdf-viewer.fileExtensions", this.updateFileExtensions.bind(this)), atom.config.observe("pdf-viewer.enableSynctex", this.toggleSynctex.bind(this)));
    }
    deserialize(params) {
        const pdfEditor = pdf_editor_1.PdfEditor.deserialize(params);
        if (pdfEditor) {
            this.subscribeToEditor(pdfEditor);
        }
        return pdfEditor;
    }
    subscribeToEditor(editor) {
        this.editors.add(editor);
        editor.onDidDispose(() => {
            this.editors.delete(editor);
        });
        this.openSubscriptions.forEach(cb => {
            cb(editor);
        });
    }
    dispose() {
        this.subscriptions.dispose();
    }
    deactivate() {
        this.dispose();
    }
    updateFileExtensions(extensions) {
        this.pdfExtensions.clear();
        for (let extension of extensions) {
            extension = extension.toLowerCase().replace(/^\.*/, ".");
            this.pdfExtensions.add(extension);
        }
    }
    toggleSynctex(enabled) {
        if (enabled) {
            if (!this.synctexConsumer) {
                this.synctexConsumer = new pfdview_consumer_synctex_1.SynctexConsumer();
                this.synctexConsumer.consumePdfview(this.providePdfEvents());
            }
        }
        else if (this.synctexConsumer) {
            atom.notifications.addInfo("Restart to disable SyncTeX");
        }
    }
    providePdfEvents() {
        return {
            observePdfViews: cb => {
                this.editors.forEach(editor => {
                    cb(editor);
                });
                this.openSubscriptions.add(cb);
                return new atom_1.Disposable(() => {
                    this.openSubscriptions.delete(cb);
                });
            },
            onDidOpenPdfView: cb => {
                this.openSubscriptions.add(cb);
                return new atom_1.Disposable(() => {
                    this.openSubscriptions.delete(cb);
                });
            },
        };
    }
}
const pack = new PdfViewPackage();
module.exports = pack;
