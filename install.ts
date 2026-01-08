import { join } from "path";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { $ } from "bun";

// Configuration
const REPO = "kuma-00/mogu-bun"; // Replace with actual repository if different
const DEFAULT_MODEL_URL = "https://huggingface.co/onnx-community/mobilenetv4_conv_small.e2400_r224_in1k/resolve/main/onnx/model.onnx";

// Detect platform and architecture
const platform = process.platform;
const arch = process.arch;

let assetName = "";
let libName = "";

if (platform === "linux" && arch === "x64") {
  assetName = "mogu-ffi-linux-x64.so";
  libName = "libmogu_ffi.so";
} else if (platform === "darwin" && arch === "arm64") {
  assetName = "mogu-ffi-darwin-arm64.dylib";
  libName = "libmogu_ffi.dylib";
} else if (platform === "win32" && arch === "x64") {
  assetName = "mogu-ffi-windows-x64.dll";
  libName = "mogu_ffi.dll";
} else {
  console.warn(`⚠️  Unsupported platform or architecture: ${platform}-${arch}. Build from source might be required.`);
  // We don't exit with error to allow local build scenarios to proceed if the user knows what they are doing
  process.exit(0);
}

// Get version from package.json
import packageJson from "./package.json";
const version = `v${packageJson.version}`;

// Construct download URL
// Use 'latest' for development/install if specific tag isn't available, but strict versioning is better for production
// For now, let's try to fetch the specific version tag
const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;

const binDir = join(import.meta.dir, "bin");
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

const libPath = join(binDir, libName);
const modelPath = join(binDir, "model.onnx");

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  if (existsSync(destPath)) {
    console.log(`✅ ${destPath.split("/").pop()} already exists.`);
    return true;
  }

  console.log(`⬇️  Downloading ${url}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️  Release asset not found: ${url}.`);
        return false;
      }
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await Bun.write(destPath, arrayBuffer);
    console.log(`✅ Downloaded to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading ${url}:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Running postinstall setup...");

  // 1. Try to Download Binary
  const binaryDownloaded = await downloadFile(downloadUrl, libPath);

  if (!binaryDownloaded) {
    console.log("🛠️  Binary not found in releases. Attempting to build from source...");
    try {
      // Run 'bun run build'
      // We use Bun.spawnSync to inherit stdio
      const proc = Bun.spawnSync(["bun", "run", "build"], {
        cwd: import.meta.dir,
        stdout: "inherit",
        stderr: "inherit",
      });

      if (proc.exitCode !== 0) {
        console.error("❌ Build failed. Please ensure Rust/Cargo is installed.");
        process.exit(1);
      }
      console.log("✅ Build successful.");
    } catch (err) {
      console.error("❌ Failed to run build script:", err);
      process.exit(1);
    }
  }

  // 2. Download Model
  // We don't strictly require the model to be downloaded during install
  // as the library can download it at runtime.
  await downloadFile(DEFAULT_MODEL_URL, modelPath);

  console.log("✨ Postinstall setup complete.");
}

main().catch(console.error);
