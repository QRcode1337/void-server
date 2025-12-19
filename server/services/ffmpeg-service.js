const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');

const DATA_DIR = path.join(process.cwd(), 'data');
const BIN_DIR = path.join(DATA_DIR, 'bin');

// Static ffmpeg download URLs (auto-updated from GitHub releases)
const FFMPEG_URLS = {
  win32: {
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    binary: 'ffmpeg.exe',
    extractPath: 'ffmpeg-master-latest-win64-gpl/bin'
  },
  darwin: {
    url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
    binary: 'ffmpeg',
    extractPath: ''
  },
  linux: {
    url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
    binary: 'ffmpeg',
    extractPath: 'ffmpeg-*-amd64-static'
  }
};

let cachedFfmpegPath = null;

/**
 * Check if a binary exists in PATH
 */
function checkBinaryInPath(binary) {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';

  return new Promise((resolve) => {
    const check = spawn(cmd, [binary], {
      shell: isWindows,
      windowsHide: true
    });

    let output = '';
    check.stdout.on('data', (data) => { output += data.toString(); });

    check.on('close', (code) => {
      if (code === 0 && output.trim()) {
        // Return first path found
        resolve(output.trim().split('\n')[0].trim());
      } else {
        resolve(null);
      }
    });

    check.on('error', () => resolve(null));
  });
}

/**
 * Download file to destination
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const makeRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      console.log(`📥 Downloading from ${currentUrl.substring(0, 60)}...`);

      protocol.get(currentUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          makeRequest(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        const file = fsSync.createWriteStream(destPath);
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });

        file.on('error', (err) => {
          fsSync.unlinkSync(destPath);
          reject(err);
        });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Extract archive (zip or tar.xz)
 */
async function extractArchive(archivePath, destDir, extractPath) {
  const isZip = archivePath.endsWith('.zip');

  if (isZip) {
    console.log('📦 Extracting zip archive...');
    const zip = new AdmZip(archivePath);

    // Find the binary in the zip
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.endsWith('ffmpeg.exe') || entry.entryName.endsWith('/ffmpeg')) {
        const content = entry.getData();
        const destFile = path.join(destDir, path.basename(entry.entryName));
        await fs.writeFile(destFile, content);
        await fs.chmod(destFile, 0o755);
        console.log(`✅ Extracted ${path.basename(entry.entryName)}`);

        // Also extract ffprobe if available
        const ffprobeName = entry.entryName.replace('ffmpeg', 'ffprobe');
        const ffprobeEntry = entries.find(e => e.entryName === ffprobeName);
        if (ffprobeEntry) {
          const ffprobeContent = ffprobeEntry.getData();
          const ffprobeDestFile = path.join(destDir, path.basename(ffprobeEntry.entryName));
          await fs.writeFile(ffprobeDestFile, ffprobeContent);
          await fs.chmod(ffprobeDestFile, 0o755);
          console.log(`✅ Extracted ${path.basename(ffprobeEntry.entryName)}`);
        }

        return destFile;
      }
    }
    throw new Error('ffmpeg binary not found in archive');
  } else {
    // tar.xz extraction (Linux)
    console.log('📦 Extracting tar.xz archive...');
    execSync(`tar -xf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });

    // Find extracted binary
    const files = await fs.readdir(destDir);
    for (const dir of files) {
      const ffmpegPath = path.join(destDir, dir, 'ffmpeg');
      const exists = await fs.access(ffmpegPath).then(() => true).catch(() => false);
      if (exists) {
        // Move to bin dir root
        const destFile = path.join(destDir, 'ffmpeg');
        await fs.rename(ffmpegPath, destFile);
        await fs.chmod(destFile, 0o755);

        // Also move ffprobe
        const ffprobePath = path.join(destDir, dir, 'ffprobe');
        const ffprobeExists = await fs.access(ffprobePath).then(() => true).catch(() => false);
        if (ffprobeExists) {
          const ffprobeDestFile = path.join(destDir, 'ffprobe');
          await fs.rename(ffprobePath, ffprobeDestFile);
          await fs.chmod(ffprobeDestFile, 0o755);
        }

        return destFile;
      }
    }
    throw new Error('ffmpeg binary not found after extraction');
  }
}

/**
 * Download and install ffmpeg
 */
async function downloadFfmpeg() {
  const platform = process.platform;
  const config = FFMPEG_URLS[platform];

  if (!config) {
    throw new Error(`Unsupported platform: ${platform}. Please install ffmpeg manually.`);
  }

  console.log(`🔧 FFmpeg not found. Downloading for ${platform}...`);

  // Create bin directory
  await fs.mkdir(BIN_DIR, { recursive: true });

  // Download archive
  const archiveExt = config.url.includes('.tar.xz') ? '.tar.xz' : '.zip';
  const archivePath = path.join(BIN_DIR, `ffmpeg-download${archiveExt}`);

  await downloadFile(config.url, archivePath);

  // Extract
  const ffmpegPath = await extractArchive(archivePath, BIN_DIR, config.extractPath);

  // Cleanup archive
  await fs.unlink(archivePath).catch(() => {});

  console.log(`✅ FFmpeg installed to ${ffmpegPath}`);

  return ffmpegPath;
}

/**
 * Get path to ffmpeg binary, downloading if necessary
 */
async function getFfmpegPath() {
  // Return cached path if valid
  if (cachedFfmpegPath) {
    const exists = await fs.access(cachedFfmpegPath).then(() => true).catch(() => false);
    if (exists) return cachedFfmpegPath;
  }

  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';

  // Check local bin directory first
  const localPath = path.join(BIN_DIR, binaryName);
  const localExists = await fs.access(localPath).then(() => true).catch(() => false);
  if (localExists) {
    cachedFfmpegPath = localPath;
    return localPath;
  }

  // Check PATH
  const pathBinary = await checkBinaryInPath('ffmpeg');
  if (pathBinary) {
    cachedFfmpegPath = pathBinary;
    return pathBinary;
  }

  // Download ffmpeg
  cachedFfmpegPath = await downloadFfmpeg();
  return cachedFfmpegPath;
}

/**
 * Get path to ffprobe binary
 */
async function getFfprobePath() {
  const ffmpegPath = await getFfmpegPath();
  const dir = path.dirname(ffmpegPath);
  const isWindows = process.platform === 'win32';
  const ffprobeName = isWindows ? 'ffprobe.exe' : 'ffprobe';

  // Check same directory as ffmpeg
  const localPath = path.join(dir, ffprobeName);
  const localExists = await fs.access(localPath).then(() => true).catch(() => false);
  if (localExists) return localPath;

  // Check PATH
  const pathBinary = await checkBinaryInPath('ffprobe');
  if (pathBinary) return pathBinary;

  throw new Error('ffprobe not found. It should be installed alongside ffmpeg.');
}

/**
 * Check if ffmpeg is available (without downloading)
 */
async function isFfmpegAvailable() {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';

  // Check local
  const localPath = path.join(BIN_DIR, binaryName);
  const localExists = await fs.access(localPath).then(() => true).catch(() => false);
  if (localExists) return true;

  // Check PATH
  const pathBinary = await checkBinaryInPath('ffmpeg');
  return !!pathBinary;
}

/**
 * Run ffmpeg with arguments
 */
async function runFfmpeg(args) {
  const ffmpegPath = await getFfmpegPath();

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve({ code, stderr });
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });

    proc.on('error', reject);
  });
}

/**
 * Run ffprobe with arguments
 */
async function runFfprobe(args) {
  const ffprobePath = await getFfprobePath();

  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
    });

    proc.on('error', reject);
  });
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  isFfmpegAvailable,
  runFfmpeg,
  runFfprobe,
  downloadFfmpeg
};
