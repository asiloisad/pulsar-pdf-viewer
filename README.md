# pdf-viewer

<p align="center">
  <a href="https://github.com/bacadra/atom-pdf-viewer/tags">
  <img src="https://img.shields.io/github/v/tag/bacadra/atom-pdf-viewer?style=for-the-badge&label=Latest&color=blue" alt="Latest">
  </a>
  <a href="https://github.com/bacadra/atom-pdf-viewer/issues">
  <img src="https://img.shields.io/github/issues-raw/bacadra/atom-pdf-viewer?style=for-the-badge&color=blue" alt="OpenIssues">
  </a>
  <a href="https://github.com/bacadra/atom-pdf-viewer/blob/master/package.json">
  <img src="https://img.shields.io/github/languages/top/bacadra/atom-pdf-viewer?style=for-the-badge&color=blue" alt="Language">
  </a>
  <a href="https://github.com/bacadra/atom-pdf-viewer/blob/master/LICENSE">
  <img src="https://img.shields.io/github/license/bacadra/atom-pdf-viewer?style=for-the-badge&color=blue" alt="Licence">
  </a>
</p>

![title-pic](https://github.com/bacadra/atom-pdf-viewer/blob/master/assets/title-pic.png?raw=true)

PDF viewer for Atom. It is a wrapper around Mozilla's PDF.js library including its viewer application, adapted for the Atom environment.

PDF files can be opened from the Atom user interface, e.g. from the project tree view, or programmatically through `atom.workspace.open(uri)`. The package watches for file changes and reloads the PDF if necessary. Viewer panes are persistent across Atom runs. The `uri` consist of filepath and optional [parameters](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## Installation

### Atom Text Editor

The official Atom packages store has been [disabled](https://github.blog/2022-06-08-sunsetting-atom/). To get latest version run the shell command

    apm install bacadra/atom-pdf-viewer

and obtain the package directly from Github repository.

### Pulsar Text Editor

The package has compability with [Pulsar](https://pulsar-edit.dev/) and can be install

    ppm install bacadra/atom-pdf-viewer

or directly [pdf-viewer](https://web.pulsar-edit.dev/packages/pdf-viewer) from Pulsar package store.

## Keyboard shortcuts

The keyboard shortcuts inside the PDF.js viewer have remained unchanged. It is not possible to change these shortcuts from within Atom. For more information, see [default keymap](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-shortcuts):

* The `Home`, `End`, `PageUp`, `PageDown` and all arrow keys can be used to navigate the document;
* Next page: `N`, `J`, `Space` (presentation mode only), `Enter` (presentation mode only) or `LeftClick` (presentation mode only);
* Previous page: `P`, `K`, `Shift-Space` (presentation mode only), `Shift-Enter` (presentation mode only) or `Shift-LeftClick` (presentation mode only);
* User interface buttons or `Ctrl-MouseWheel` can be used to change the zooming level;
* Zoom in: `Ctrl-+`, `Ctrl-=`;
* Zoom out: `Ctrl--`;
* Restore normal zoom: `Ctrl-0`;
* Rotate the document clockwise: `r`;
* Rotate the document counterclockwise: `Shift-R`;
* Activate presentation mode: `Ctrl-Alt-P`;
* Enable the hand tool: `h`;
* Enable the text selection tool: `s`;
* Move focus to the 'go to page' box: `Ctrl-Alt-G`;
* Find text in the document: `Ctrl-F`;
* Find next occurrence of text in the document: `Ctrl-G`;
* Find previous occurrence of text in the document: Shift + `Ctrl-G`;
* Print the document: unset;
* Download the document: `Ctrl-S`;
* Open a file: `Ctrl-O`;
* Use `F4` to toggle the visibility of the sidebar;

After showing the sidebar, click on the "Show document outline" button (Show document outline) to show the document outline (if the PDF file has one). Nested outline items can be expanded/collapsed by clicking on the triangles at the left of an item. To expand/collapse all items under the selected item, press `Shift` while clicking on the triangle. Double-click on the "Show document outline" button (Show document outline) to expand/collapse all outline items.

Additional keyboard shortcuts has been introduced:

* Open command-palette: `Ctrl-Shift-P`, `F1`;
* Refresh content for current viewer: `F5`;
* Auto-refreshing toggle for current viewer: `Ctrl-F5`
* Invert colors for current viewer; `F8`:
* Use SyncTeX and go `.tex`. file, if possible: `RightClick`;

## Style

The style of the documents has been adapted to the theme in Atom. As the style changes, you may notice the menu colours change. An additional option has been introduced to invert the colours of the document itself. To invert the document colours change the options in the package settings, use the `pdf-viewer:invert-mode` from command-palette or press the `F8` to change it in active file.

![dark-mode](https://github.com/bacadra/atom-pdf-viewer/blob/master/assets/dark-mode.png?raw=true)

## Document outline

The viewer support the [navigation-panel](https://github.com/bacadra/atom-navigation-panel). You can search through document by all-in outline tree instead of PDFjs outline.

## URI options

The package supports additional options when opening. With them you can open on a specified page, set the initial zoom, open the file on a named destination or select a sidebar state. For more information see [pdf.js viewer options](https://github.com/mozilla/pdf.js/wiki/Viewer-options).

## LaTeX

This package supports SyncTeX `.tex` and `.pdf` in both directions. From a text file `.tex` to `.pdf` use the command `pdf-viewer:synctex` from command-palette, while from `.pdf` to `.tex` you need to mouse `RightClick`.

For PDF files created by TeX using the `--synctex=1` option, a click on the PDF will take you to the corresponding source code. If the synctex command (part of modern TeX distributions) is in your PATH, this will work out of the box, otherwise you can configure the path to the synctex binary in the settings.

The viewer can remember the page before refresh and set it initialy after refresh.

![latex-synctex](https://github.com/bacadra/atom-pdf-viewer/blob/master/assets/latex-synctex.png?raw=true)

## SOFiSTiK

This package is adapted to support `sofistik-tools` for help functions using the search keywords at current scope. For more information see the package [sofistik-tools](https://github.com/bacadra/atom-sofistik-tools).

# Contributing [🍺](https://www.buymeacoffee.com/asiloisad)

If you have ideas on how to improve the package, see bugs or want to support new features - feel free to share it via GitHub.

See my other packages for Atom & Pulsar Text Editors:
<p align="center">
<a href="https://github.com/bacadra/atom-autocomplete-sofistik"><img src="https://img.shields.io/github/v/tag/bacadra/atom-autocomplete-sofistik?style=for-the-badge&label=autocomplete-sofistik&color=blue" alt="autocomplete-sofistik">
<a href="https://github.com/bacadra/atom-bib-finder"><img src="https://img.shields.io/github/v/tag/bacadra/atom-bib-finder?style=for-the-badge&label=bib-finder&color=blue" alt="bib-finder">
<a href="https://github.com/bacadra/atom-hydrogen-run"><img src="https://img.shields.io/github/v/tag/bacadra/atom-hydrogen-run?style=for-the-badge&label=hydrogen-run&color=blue" alt="hydrogen-run">
<a href="https://github.com/bacadra/atom-image-paste"><img src="https://img.shields.io/github/v/tag/bacadra/atom-image-paste?style=for-the-badge&label=image-paste&color=blue" alt="image-paste">
<a href="https://github.com/bacadra/atom-language-latex"><img src="https://img.shields.io/github/v/tag/bacadra/atom-language-latex?style=for-the-badge&label=language-latex&color=blue" alt="language-latex">
<a href="https://github.com/bacadra/atom-language-sofistik"><img src="https://img.shields.io/github/v/tag/bacadra/atom-language-sofistik?style=for-the-badge&label=language-sofistik&color=blue" alt="language-sofistik">
<a href="https://github.com/bacadra/atom-linter-ruff"><img src="https://img.shields.io/github/v/tag/bacadra/atom-linter-ruff?style=for-the-badge&label=linter-ruff&color=blue" alt="linter-ruff">
<a href="https://github.com/bacadra/atom-linter-sofistik"><img src="https://img.shields.io/github/v/tag/bacadra/atom-linter-sofistik?style=for-the-badge&label=linter-sofistik&color=blue" alt="linter-sofistik">
<a href="https://github.com/bacadra/atom-navigation-panel"><img src="https://img.shields.io/github/v/tag/bacadra/atom-navigation-panel?style=for-the-badge&label=navigation-panel&color=blue" alt="navigation-panel">
<a href="https://github.com/bacadra/atom-open-external"><img src="https://img.shields.io/github/v/tag/bacadra/atom-open-external?style=for-the-badge&label=open-external&color=blue" alt="open-external">
<a href="https://github.com/bacadra/atom-pdf-viewer"><img src="https://img.shields.io/github/v/tag/bacadra/atom-pdf-viewer?style=for-the-badge&label=pdf-viewer&color=blue" alt="pdf-viewer">
<a href="https://github.com/bacadra/atom-project-files"><img src="https://img.shields.io/github/v/tag/bacadra/atom-project-files?style=for-the-badge&label=project-files&color=blue" alt="project-files">
<a href="https://github.com/bacadra/atom-regex-aligner"><img src="https://img.shields.io/github/v/tag/bacadra/atom-regex-aligner?style=for-the-badge&label=regex-aligner&color=blue" alt="regex-aligner">
<a href="https://github.com/bacadra/atom-sofistik-tools"><img src="https://img.shields.io/github/v/tag/bacadra/atom-sofistik-tools?style=for-the-badge&label=sofistik-tools&color=blue" alt="sofistik-tools">
<a href="https://github.com/bacadra/atom-super-select"><img src="https://img.shields.io/github/v/tag/bacadra/atom-super-select?style=for-the-badge&label=super-select&color=blue" alt="super-select">
<a href="https://github.com/bacadra/atom-word-map"><img src="https://img.shields.io/github/v/tag/bacadra/atom-word-map?style=for-the-badge&label=word-map&color=blue" alt="word-map">
</p>
