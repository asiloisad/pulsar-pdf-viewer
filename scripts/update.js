const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const VENDORS_DIR = path.join(__dirname, "..", "vendors");
const PACKAGE_JSON = path.join(__dirname, "..", "package.json");
const GITHUB_API = "https://api.github.com/repos/mozilla/pdf.js/releases/latest";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "pdf-viewer-updater" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      https.get(url, { headers: { "User-Agent": "pdf-viewer-updater" } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

function removeOldVersions(currentVersion) {
  const dirs = fs.readdirSync(VENDORS_DIR).filter((d) => {
    return d.startsWith("pdfjs-") && d.endsWith("-dist") && d !== `pdfjs-${currentVersion}-dist`;
  });
  for (const dir of dirs) {
    const dirPath = path.join(VENDORS_DIR, dir);
    console.log(`Removing old version: ${dir}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function patchViewerHtml(version) {
  const viewerPath = path.join(VENDORS_DIR, `pdfjs-${version}-dist`, "web", "viewer.html");
  let html = fs.readFileSync(viewerPath, "utf8");

  // Check if already patched
  if (html.includes("../../custom/viewer.css")) {
    console.log("viewer.html already patched");
    return;
  }

  // Add custom CSS and viewer-less style element after viewer.css
  html = html.replace(
    '<link rel="stylesheet" href="viewer.css" />',
    '<link rel="stylesheet" href="viewer.css" />\n' +
    '    <link rel="stylesheet" href="../../custom/viewer.css">\n' +
    '    <style id="viewer-less"></style>'
  );

  // Add custom JS after viewer.mjs (before </head>)
  html = html.replace(
    '<script src="viewer.mjs" type="module"></script>\n  </head>',
    '<script src="viewer.mjs" type="module"></script>\n' +
    '    <script src="../../custom/viewer.js"></script>\n  </head>'
  );

  fs.writeFileSync(viewerPath, html);
  console.log("Patched viewer.html with custom CSS/JS");
}

function extractZip(zipPath, destDir, version) {
  const targetDir = path.join(destDir, `pdfjs-${version}-dist`);

  // Create target directory
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (process.platform === "win32") {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${targetDir}"`, { stdio: "inherit" });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const forceUpdate =
    args.includes("--force") ||
    args.includes("-f") ||
    process.env.npm_config_force === "true";

  console.log("Fetching latest PDF.js release...");
  const release = await fetchJSON(GITHUB_API);

  if (release.message) {
    throw new Error(`GitHub API error: ${release.message}`);
  }

  const version = release.tag_name.replace("v", "");
  const asset = release.assets.find((a) => a.name === `pdfjs-${version}-dist.zip`);

  if (!asset) {
    throw new Error(`Could not find pdfjs-${version}-dist.zip in release assets`);
  }

  // Check current version
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  const currentVersion = pkg.pdfjsVersion;

  if (currentVersion === version && !forceUpdate) {
    console.log(`Already at latest version ${version}`);
    return;
  }

  console.log(`Updating from ${currentVersion || "unknown"} to ${version}...`);

  // Download
  const zipPath = path.join(VENDORS_DIR, asset.name);
  console.log(`Downloading ${asset.name}...`);
  await downloadFile(asset.browser_download_url, zipPath);
  console.log("Download complete.");

  // Remove old versions
  removeOldVersions(version);

  // Extract
  console.log("Extracting...");
  extractZip(zipPath, VENDORS_DIR, version);

  // Patch viewer.html to include custom CSS/JS
  patchViewerHtml(version);

  // Clean up zip
  fs.unlinkSync(zipPath);

  // Update package.json
  pkg.pdfjsVersion = version;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n");

  console.log(`\nUpdated to PDF.js ${version}`);
  console.log("Don't forget to test the viewer before committing!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
