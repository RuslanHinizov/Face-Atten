# -*- coding: UTF-8 -*-
"""
Экспорт YOLO в TensorRT для ускорения инференса.

Использование:
    python scripts/export_tensorrt.py
    python scripts/export_tensorrt.py --img-size 960
    python scripts/export_tensorrt.py --fp16

Требования:
    pip install tensorrt onnx onnxruntime-gpu
"""
import argparse
import torch
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import config as cfg
from models.experimental import attempt_load


def export_onnx(weights, img_size, output_path, dynamic=False):
    """Экспорт PyTorch модели в ONNX."""
    print(f"\n[1/2] Exporting to ONNX...")
    print(f"  Weights: {weights}")
    print(f"  Image size: {img_size}")

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = attempt_load(weights, map_location=device)
    model.eval()

    # Dummy input
    dummy_input = torch.zeros(1, 3, img_size, img_size).to(device)

    # Export
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        verbose=False,
        opset_version=12,
        input_names=['images'],
        output_names=['output'],
        dynamic_axes={'images': {0: 'batch', 2: 'height', 3: 'width'},
                      'output': {0: 'batch'}} if dynamic else None
    )

    print(f"  ONNX saved: {output_path}")
    print(f"  Size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
    return output_path


def export_tensorrt(onnx_path, engine_path, fp16=True, workspace_gb=4):
    """Конвертирует ONNX в TensorRT engine."""
    print(f"\n[2/2] Building TensorRT engine...")
    print(f"  ONNX: {onnx_path}")
    print(f"  FP16: {fp16}")
    print(f"  Workspace: {workspace_gb} GB")

    try:
        import tensorrt as trt
    except ImportError:
        print("\nERROR: TensorRT not installed!")
        print("Install: pip install tensorrt")
        print("\nAlternatively, use trtexec:")
        print(f"  trtexec --onnx={onnx_path} --saveEngine={engine_path} {'--fp16' if fp16 else ''}")
        return None

    logger = trt.Logger(trt.Logger.INFO)
    builder = trt.Builder(logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    # Parse ONNX
    print("  Parsing ONNX...")
    with open(onnx_path, 'rb') as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                print(f"  ERROR: {parser.get_error(i)}")
            return None

    # Build config
    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, workspace_gb * (1 << 30))

    if fp16 and builder.platform_has_fast_fp16:
        config.set_flag(trt.BuilderFlag.FP16)
        print("  FP16 enabled")

    # Build engine
    print("  Building engine (this may take several minutes)...")
    serialized_engine = builder.build_serialized_network(network, config)

    if serialized_engine is None:
        print("  ERROR: Failed to build engine")
        return None

    # Save
    with open(engine_path, 'wb') as f:
        f.write(serialized_engine)

    print(f"  Engine saved: {engine_path}")
    print(f"  Size: {os.path.getsize(engine_path) / 1024 / 1024:.1f} MB")
    return engine_path


def main():
    parser = argparse.ArgumentParser(description='Export YOLO to TensorRT')
    parser.add_argument('--weights', type=str, default=cfg.YOLO_WEIGHTS, help='PyTorch weights')
    parser.add_argument('--img-size', type=int, default=cfg.YOLO_IMG_SIZE, help='Image size')
    parser.add_argument('--fp16', action='store_true', default=True, help='FP16 mode')
    parser.add_argument('--fp32', action='store_true', help='FP32 mode (disable FP16)')
    parser.add_argument('--workspace', type=int, default=4, help='Workspace size GB')
    args = parser.parse_args()

    fp16 = args.fp16 and not args.fp32

    weights_path = Path(args.weights)
    base_name = weights_path.stem

    # Output paths
    onnx_path = weights_path.parent / f"{base_name}_{args.img_size}.onnx"
    engine_path = weights_path.parent / f"{base_name}_{args.img_size}_{'fp16' if fp16 else 'fp32'}.engine"

    print("="*60)
    print("YOLO TensorRT Export")
    print("="*60)

    # Step 1: ONNX
    if not onnx_path.exists():
        export_onnx(args.weights, args.img_size, str(onnx_path))
    else:
        print(f"\n[1/2] ONNX exists: {onnx_path}")

    # Step 2: TensorRT
    if not engine_path.exists():
        export_tensorrt(str(onnx_path), str(engine_path), fp16=fp16, workspace_gb=args.workspace)
    else:
        print(f"\n[2/2] Engine exists: {engine_path}")

    print("\n" + "="*60)
    print("DONE!")
    print("="*60)

    if engine_path.exists():
        print(f"\nTo use TensorRT, update config.py:")
        print(f"  YOLO_WEIGHTS = '{engine_path}'")
        print(f"\nOr run:")
        print(f"  python video_recognition.py --engine {engine_path}")


if __name__ == "__main__":
    main()
