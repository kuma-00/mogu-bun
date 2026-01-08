# Mogu Bun

Bun wrapper for the Mogu food detection library.

## Requirements

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) (for building the FFI library)

## Installation

```bash
bun install
```

## Building

To build the Rust FFI library for your current platform:

```bash
bun run build
```

This will build the library and copy it to the `bin/` directory.

## Usage

```bash
bun index.ts <path_to_model.onnx> <path_to_image.jpg>
```

## Cross-Platform Build

To build for other platforms, you can use `cargo build` with the `--target` flag in the `mogu-ffi` directory.

### Linux
```bash
cd mogu-ffi && cargo build --release --target x86_64-unknown-linux-gnu
```

### macOS
```bash
cd mogu-ffi && cargo build --release --target x86_64-apple-darwin # or aarch64-apple-darwin
```

### Windows
```bash
cd mogu-ffi && cargo build --release --target x86_64-pc-windows-msvc
```