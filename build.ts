import { join } from "path";
import { existsSync, mkdirSync, copyFileSync } from "fs";

// Parse arguments
const args = process.argv.slice(2);
const targetArg = args.find((arg) => arg.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : null;

console.log(`Building mogu-ffi${target ? ` for target ${target}` : ""}...`);

const cargoDir = join(process.cwd(), "mogu-ffi");
const cargoArgs = ["cargo", "build", "--release"];

if (target) {
  cargoArgs.push("--target", target);
}

// Bun.spawnSync を使用してビルドを実行
const buildProcess = Bun.spawnSync(cargoArgs, {
  cwd: cargoDir,
  stdout: "inherit",
  stderr: "inherit",
});

if (buildProcess.exitCode !== 0) {
  console.error("❌ Cargo build failed");
  process.exit(1);
}

// Determine output filename based on platform/target
let libName = "";
let isWindows = false;

if (target) {
  if (target.includes("windows")) {
    isWindows = true;
  } else if (target.includes("darwin") || target.includes("apple")) {
    libName = "libmogu_ffi.dylib";
  } else {
    libName = "libmogu_ffi.so";
  }
} else {
  // No target specified, use current platform
  const platform = process.platform;
  if (platform === "win32") {
    isWindows = true;
  } else if (platform === "darwin") {
    libName = "libmogu_ffi.dylib";
  } else {
    libName = "libmogu_ffi.so";
  }
}

if (isWindows) {
  libName = "mogu_ffi.dll";
}

// Construct source path
// If target is specified, cargo outputs to target/<target_triple>/release/
// Otherwise, it outputs to target/release/
let buildArtifactDir = join(cargoDir, "target", "release");
if (target) {
  buildArtifactDir = join(cargoDir, "target", target, "release");
}

const srcPath = join(buildArtifactDir, libName);
const destDir = join(process.cwd(), "bin");
const destPath = join(destDir, libName);

if (!existsSync(destDir)) {
  mkdirSync(destDir);
}

if (existsSync(srcPath)) {
  copyFileSync(srcPath, destPath);
  console.log(`✅ Successfully built and copied to ${destPath}`);
} else {
  console.error(`❌ Could not find built library at ${srcPath}`);
  process.exit(1);
}