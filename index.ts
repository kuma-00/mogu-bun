import { dlopen, FFIType, ptr, CString, type Pointer } from "bun:ffi";
import { join } from "path";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir } from "os";

const { platform } = process;

const DEFAULT_MODEL_URL = "https://huggingface.co/onnx-community/mobilenetv4_conv_small.e2400_r224_in1k/resolve/main/onnx/model.onnx";

let libName = "";
if (platform === "linux") {
  libName = "libmogu_ffi.so";
} else if (platform === "darwin") {
  libName = "libmogu_ffi.dylib";
} else if (platform === "win32") {
  libName = "mogu_ffi.dll";
}

const libPath = join(import.meta.dir, "bin", libName);

if (!existsSync(libPath)) {
  throw new Error(`Could not find ${libName} at ${libPath}. Please run 'bun run build' first.`);
}

const lib = dlopen(libPath, {
  mogu_detector_new: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  mogu_predict_is_food: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  mogu_predict_top_class: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  mogu_get_label: {
    args: [FFIType.i32],
    returns: FFIType.ptr,
  },
  mogu_free_string: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  mogu_detector_free: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
});

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

export class MoguDetector {
  private ptr: Pointer | null;

  constructor(modelPath: string) {
    this.ptr = lib.symbols.mogu_detector_new(Buffer.from(modelPath + "\0"));
    if (!this.ptr) {
      throw new Error("Failed to create MoguDetector. Check if the model path is correct.");
    }
  }

  static async create(modelSource?: string): Promise<MoguDetector> {
    let modelPath = modelSource;
    const binDir = join(import.meta.dir, "bin");
    const defaultModelPath = join(binDir, "model.onnx");

    // If no model provided, try to use the default local model first
    if (!modelSource) {
      if (existsSync(defaultModelPath)) {
        modelPath = defaultModelPath;
      } else {
        // Fallback: Use default URL to download
        modelSource = DEFAULT_MODEL_URL;
        modelPath = defaultModelPath;
      }
    }

    if (modelSource && isUrl(modelSource)) {
      if (!existsSync(binDir)) {
        mkdirSync(binDir, { recursive: true });
      }

      const fileName = modelSource.split("/").pop() || "model.onnx";
      const targetPath = join(binDir, fileName);

      if (!existsSync(targetPath)) {
        console.log(`Downloading model from ${modelSource}...`);
        const response = await fetch(modelSource);
        if (!response.ok) {
          throw new Error(`Failed to download model: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await Bun.write(targetPath, arrayBuffer);
        console.log(`Model downloaded to ${targetPath}`);
      }
      modelPath = targetPath;
    }

    if (!modelPath) {
       throw new Error("Model path not provided and default model not found.");
    }

    return new MoguDetector(modelPath);
  }

  async predictIsFood(imageSource: string): Promise<{ isFood: boolean; probability: number }> {
    if (!this.ptr) throw new Error("Detector is already freed");
    let filePath = imageSource;
    let isTemp = false;

    if (isUrl(imageSource)) {
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const tempPath = join(tmpdir(), `mogu_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      await Bun.write(tempPath, arrayBuffer);
      filePath = tempPath;
      isTemp = true;
    }

    try {
      const probPtr = new Float32Array(1);
      const result = lib.symbols.mogu_predict_is_food(
        this.ptr,
        Buffer.from(filePath + "\0"),
        ptr(probPtr)
      );

      if (result === -1) {
        throw new Error("Prediction failed");
      }

      return {
        isFood: result === 1,
        probability: probPtr[0]!,
      };
    } finally {
      if (isTemp && existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
  }

  async predictTopClass(imageSource: string): Promise<{ classIndex: number; probability: number; label: string }> {
    if (!this.ptr) throw new Error("Detector is already freed");
    let filePath = imageSource;
    let isTemp = false;

    if (isUrl(imageSource)) {
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const tempPath = join(tmpdir(), `mogu_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      await Bun.write(tempPath, arrayBuffer);
      filePath = tempPath;
      isTemp = true;
    }

    try {
      const probPtr = new Float32Array(1);
      const classIndex = lib.symbols.mogu_predict_top_class(
        this.ptr,
        Buffer.from(filePath + "\0"),
        ptr(probPtr)
      );

      if (classIndex === -1) {
        throw new Error("Prediction failed");
      }

      const labelPtr = lib.symbols.mogu_get_label(classIndex);
      let label = "unknown";
      if (labelPtr) {
        label = new CString(labelPtr).toString();
        lib.symbols.mogu_free_string(labelPtr);
      }

      return {
        classIndex,
        probability: probPtr[0]!,
        label,
      };
    } finally {
      if (isTemp && existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }
  }

  free() {
    if (this.ptr) {
      lib.symbols.mogu_detector_free(this.ptr);
      this.ptr = null;
    }
  }
}

// Example usage
if (import.meta.main) {
  const args = process.argv.slice(2);
  let command = "top";
  let imageSource = "";
  let modelSource: string | undefined;

  if (args[0] === "food" || args[0] === "top") {
    command = args.shift()!;
  }

  imageSource = args[0] || "";
  modelSource = args[1];

  if (!imageSource) {
    console.log("Usage: bun index.ts [food|top] <image_path_or_url> [model_path_or_url]");
    console.log("\nCommands:");
    console.log("  top   - Predict the top class (default)");
    console.log("  food  - Check if the image contains food");
    process.exit(1);
  }

  try {
    const detector = await MoguDetector.create(modelSource);
    
    if (command === "food") {
      const result = await detector.predictIsFood(imageSource);
      console.log(`Is Food: ${result.isFood} (${(result.probability * 100).toFixed(2)}%)`);
    } else {
      const result = await detector.predictTopClass(imageSource);
      console.log(`Result: ${result.label} (${(result.probability * 100).toFixed(2)}%)`);
    }
    
    detector.free();
  } catch (e) {
    console.error(e);
  }
}