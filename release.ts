import { $ } from "bun";

// Ensure git status is clean
const status = await $`git status --porcelain`.text();
if (status.trim() !== "") {
  console.error("❌ Git working directory is not clean. Commit or stash changes first.");
  process.exit(1);
}

// Get current version
import packageJson from "./package.json";
const currentVersion = packageJson.version;

console.log(`Current version: ${currentVersion}`);
const confirm = prompt("Enter new version (or press enter to keep current and just push tag):");
let version = currentVersion;

if (confirm && confirm.trim() !== "") {
  version = confirm.trim();
  // Update package.json
  const newPackageJson = { ...packageJson, version };
  await Bun.write("package.json", JSON.stringify(newPackageJson, null, 2) + "\n");
  
  // Also update Cargo.toml files if needed, but for now assuming JS is source of truth for release tag
  // You might want to update mogu-ffi/Cargo.toml version too.

  console.log(`Updated package.json to ${version}`);
  
  await $`git add package.json`;
  await $`git commit -m "chore: release v${version}"`;
}

const tagName = `v${version}`;

console.log(`Creating and pushing tag ${tagName}...`);

try {
  await $`git tag ${tagName}`;
  await $`git push origin main`; // Push commit if any
  await $`git push origin ${tagName}`;
  console.log(`✅ Successfully pushed tag ${tagName}. GitHub Action should start now.`);
} catch (error) {
  console.error("❌ Failed to tag or push.");
  console.error(error);
  process.exit(1);
}
