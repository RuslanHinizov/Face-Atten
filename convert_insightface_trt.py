# -*- coding: UTF-8 -*-
"""
Конвертация InsightFace ONNX моделей в TensorRT FP16 engines
с динамическими профилями для батчевого inference.
"""
import os
import tensorrt as trt

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "models", "insightface", "models", "buffalo_l")

INPUT_NAME = "input.1"

CONVERSIONS = [
    {
        "onnx": os.path.join(MODELS_DIR, "det_10g.onnx"),
        "engine": os.path.join(MODELS_DIR, "det_10g_fp16.engine"),
        "min": (1, 3, 256, 256),
        "opt": (1, 3, 256, 256),
        "max": (1, 3, 512, 512),
    },
    {
        "onnx": os.path.join(MODELS_DIR, "w600k_r50.onnx"),
        "engine": os.path.join(MODELS_DIR, "w600k_r50_fp16.engine"),
        "min": (1, 3, 112, 112),
        "opt": (8, 3, 112, 112),
        "max": (16, 3, 112, 112),
    },
]


def convert(onnx_path, engine_path, shape_min, shape_opt, shape_max):
    logger = trt.Logger(trt.Logger.INFO)
    builder = trt.Builder(logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    print(f"\n{'='*60}")
    print(f"ONNX:   {onnx_path}")
    print(f"Engine: {engine_path}")
    print(f"Min: {shape_min}  Opt: {shape_opt}  Max: {shape_max}")
    print(f"{'='*60}")

    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                print(f"  Parse error: {parser.get_error(i)}")
            raise RuntimeError(f"Failed to parse {onnx_path}")

    config = builder.create_builder_config()
    config.set_flag(trt.BuilderFlag.FP16)
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)  # 1 GB

    profile = builder.create_optimization_profile()
    profile.set_shape(INPUT_NAME, shape_min, shape_opt, shape_max)
    config.add_optimization_profile(profile)

    print("Building engine (this may take a few minutes)...")
    serialized = builder.build_serialized_network(network, config)
    if serialized is None:
        raise RuntimeError(f"Failed to build engine for {onnx_path}")

    with open(engine_path, "wb") as f:
        f.write(serialized)

    size_mb = os.path.getsize(engine_path) / (1024 * 1024)
    print(f"Saved: {engine_path} ({size_mb:.1f} MB)")


def main():
    for c in CONVERSIONS:
        if not os.path.exists(c["onnx"]):
            print(f"SKIP: {c['onnx']} not found")
            continue
        convert(c["onnx"], c["engine"], c["min"], c["opt"], c["max"])

    print(f"\n{'='*60}")
    print("Done!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
