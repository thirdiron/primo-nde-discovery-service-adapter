const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
require('dotenv').config({ path: './build-settings.env' });

const distPath = path.join(__dirname, 'dist', 'custom-module');
const targetPath = path.join(__dirname, 'dist', `${process.env.INST_ID}-${process.env.VIEW_ID}`);
const zipPath = path.join(__dirname, 'dist', `${process.env.INST_ID}-${process.env.VIEW_ID}.zip`);

function removeDirectory(directory, callback) {
  fs.rm(directory, { recursive: true, force: true }, callback);
}

function renameAndArchive() {
  fs.rename(distPath, targetPath, err => {
    if (err) throw err;
    console.log(`Renamed directory to ${targetPath}`);

    // NOTE: we used to build a `custom.css` bundle here and copy it to assets/css/custom.css, one of
    // the two paths Primo probes for a view customization package's stylesheet. It was dead weight:
    // our add-on is deployed as a module-federation remote via Alma's Add-On URL, not as a view
    // package, so nothing ever linked the file. All of our styles now ship inside the bundle — see
    // src/app/styles/host-element-overrides.ts for the one case that has to be injected unscoped.

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Archive completed: ${archive.pointer()} total bytes`);
      console.log(`Zip file created at: ${zipPath}`);
      console.log(
        'Please upload the zip file to Alma BO custom package section to deploy your custom module.'
      );
    });

    archive.on('warning', err => {
      if (err.code === 'ENOENT') {
        console.log('Warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', err => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(targetPath, path.basename(targetPath)); // This ensures the directory itself is included
    archive.finalize();
  });
}

// Check if target directory exists and remove it if it does
if (fs.existsSync(targetPath)) {
  removeDirectory(targetPath, err => {
    if (err) throw err;
    renameAndArchive();
  });
} else {
  renameAndArchive();
}
