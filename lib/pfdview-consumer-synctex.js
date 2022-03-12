"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynctexConsumer = void 0;
const cp = require("child_process");
const path = require("path");
const atom_1 = require("atom");
class SynctexConsumer {
    constructor() {
        this.subscriptions = new atom_1.CompositeDisposable();
        this.destroyed = false;
        atom.commands.add("atom-text-editor", {
            "pdf-viewer:forward-sync": function (event) {
                const editor = atom.workspace.getActiveTextEditor();
                if (!editor) {
                    return;
                }
                const file = editor.getPath();
                if (!file || !file.endsWith(".tex")) {
                    return;
                }
                const openPdfs = atom.workspace
                    .getPaneItems()
                    .filter((p) => p.getPath && p.getPath().endsWith(".pdf"));
                if (openPdfs.length === 0) {
                    return;
                }
                const pdf = openPdfs[0];
                const position = editor.getLastCursor().getBufferPosition();
                const command = `synctex view -i ${position.row + 1}:${position.column +
                    1}:"${file}" -o "${pdf.getPath()}"`;
                cp.exec(command, (err, stdout, stderr) => {
                    if (err) {
                        console.warn(stderr);
                        return;
                    }
                    const location = parseForwardSynctex(stdout);
                    if (typeof pdf.scrollToPosition === "function") {
                        pdf.scrollToPosition(location, { origin: "TL" });
                    }
                });
            },
        });
    }
    destroy() {
        this.subscriptions.dispose();
        this.destroyed = true;
    }
    consumePdfview(pdfView) {
        this.subscriptions.add(pdfView.observePdfViews(editor => {
            editor.onDidClick(evt => {
                console.log(evt.position);
            });
            editor.onDidDoubleClick(evt => {
                if (this.destroyed) {
                    return;
                }
                const { pageIndex, pointX, pointY, height } = evt.position;
                const cmd = `synctex edit -o "${pageIndex + 1}:${Math.floor(pointX)}:${Math.floor(height - pointY)}:${editor.getPath()}"`;
                cp.exec(cmd, (err, stdout) => {
                    if (err) {
                        return;
                    }
                    const location = parseSynctex(stdout);
                    if (location.source === undefined || location.row === undefined) {
                        console.error("Could not read synctex output properly");
                        return;
                    }
                    atom.workspace.open(location.source, {
                        initialLine: location.row,
                        initialColumn: location.column && location.column >= 0 ? location.column : 0,
                        searchAllPanes: true,
                    });
                });
            });
        }));
    }
}
exports.SynctexConsumer = SynctexConsumer;
function parseForwardSynctex(stdout) {
    const location = {};
    const lines = stdout.split(/\r?\n/g);
    console.log(lines);
    for (const line of lines) {
        const match = line.match(/^(\w+):(.+)$/);
        if (!match) {
            continue;
        }
        const key = match[1];
        const val = match[2];
        switch (key) {
            case "Page":
                location.pageIndex = parseInt(val, 10) - 1;
                break;
            case "x":
                location.pointX = parseFloat(val);
                break;
            case "v":
                location.pointY = parseFloat(val);
                break;
            case "before":
                return location;
        }
    }
    return location;
}
function parseSynctex(stdout) {
    const location = {};
    const lines = stdout.split(/\r?\n/g);
    for (const line of lines) {
        const match = line.match(/^(\w+):(.+)$/);
        if (!match) {
            continue;
        }
        const key = match[1];
        const val = match[2];
        switch (key) {
            case "Input":
                location.source = path.normalize(val);
                break;
            case "Line":
                location.row = parseInt(val, 10) - 1;
                break;
            case "Column":
                location.column = parseInt(val, 10);
                break;
        }
    }
    return location;
}
