# Mogu Bun

Bun wrapper for the Mogu food detection library. This tool allows you to detect food in images and classify them using the Mogu library via FFI. It supports automatic model downloading and direct image URLs.

## Requirements

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) (Required for building the FFI library during installation)

## Installation

```bash
bun add github:kuma-00/mogu-bun
```

## Library Usage

You can use `MoguDetector` to detect food in images programmatically.

```typescript
import { MoguDetector } from "mogu-bun";

// 1. Initialize the detector
// If no model path is provided, the default model will be downloaded automatically.
const detector = await MoguDetector.create();

// Alternatively, provide a path or URL to a custom ONNX model:
// const detector = await MoguDetector.create("./custom_model.onnx");

// 2. Perform detection
const imageSource = "https://example.com/pizza.jpg"; // Can be a local path or URL

try {
  // Check if it is food
  const { isFood, probability } = await detector.predictIsFood(imageSource);
  console.log(`Is Food: ${isFood} (Probability: ${probability})`);

  // Get top classification
  const topClass = await detector.predictTopClass(imageSource);
  console.log(`Label: ${topClass.label} (Probability: ${topClass.probability})`);

} catch (error) {
  console.error("Detection failed:", error);
} finally {
  // 3. Free memory
  detector.free();
}
```

## CLI Usage

You can also run the detector directly from the command line if you clone the repository:

```bash
bun index.ts <image_path_or_url> [model_path_or_url]
```