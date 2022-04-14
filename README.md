# pdf-viewer



## General

This package integrates Mozilla's PDF.js platform and viewer almost directly into an Atom pane. This gives you the same set of features you find in the Firefox PDF viewer (which also uses PDF.js), and means updates upstream can be easily incorporated.

The package was built on top of [pdf-view-plus](https://github.com/Aerijo/atom-pdf-view-plus), but some changes were made. Updated PDF.js package, slightly changed css, introduced parameters handling etc.

The viewer handles the parameters via the URI. It can be used together with the [sofisitk-tools](https://github.com/bacadra/atom-sofistik-tools) package to get help on the keyword next to the cursor.
























- [x] sofistik-tools dynamic help via parameters
- [x] manual reload of pdf by command `pdf-viewer:reload-all`
- [x] document outline as default side toolbar
- [x] customize document outline to be more readable & hidden at start
- [x] SyncTeX `.tex` → `.pdf` as command `pdf-viewer:forward-sync`
- [ ] SyncTeX `.pdf` → `.tex`
