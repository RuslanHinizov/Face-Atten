# -*- coding: UTF-8 -*-
"""TensorRT инференс для YOLO (legacy pycuda-based)."""
import numpy as np
import torch

try:
    import tensorrt as trt
    import pycuda.driver as cuda
    import pycuda.autoinit
    TENSORRT_AVAILABLE = True
except ImportError:
    TENSORRT_AVAILABLE = False


class TensorRTInference:
    """TensorRT инференс для YOLO."""

    def __init__(self, engine_path):
        if not TENSORRT_AVAILABLE:
            raise RuntimeError("TensorRT not available. Install: pip install tensorrt pycuda")

        self.logger = trt.Logger(trt.Logger.WARNING)

        # Load engine
        with open(engine_path, 'rb') as f:
            self.engine = trt.Runtime(self.logger).deserialize_cuda_engine(f.read())

        self.context = self.engine.create_execution_context()

        # Allocate buffers
        self.inputs = []
        self.outputs = []
        self.bindings = []
        self.stream = cuda.Stream()

        for i in range(self.engine.num_io_tensors):
            name = self.engine.get_tensor_name(i)
            dtype = trt.nptype(self.engine.get_tensor_dtype(name))
            shape = self.engine.get_tensor_shape(name)
            size = trt.volume(shape)
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)

            self.bindings.append(int(device_mem))

            if self.engine.get_tensor_mode(name) == trt.TensorIOMode.INPUT:
                self.inputs.append({'host': host_mem, 'device': device_mem, 'shape': shape})
            else:
                self.outputs.append({'host': host_mem, 'device': device_mem, 'shape': shape})

    def __call__(self, x):
        """Инференс с тензором [B,C,H,W]."""
        # x: torch.Tensor -> numpy
        if isinstance(x, torch.Tensor):
            x = x.cpu().numpy()

        # Copy to input
        np.copyto(self.inputs[0]['host'], x.ravel())
        cuda.memcpy_htod_async(self.inputs[0]['device'], self.inputs[0]['host'], self.stream)

        # Execute
        self.context.execute_async_v2(bindings=self.bindings, stream_handle=self.stream.handle)

        # Copy output
        cuda.memcpy_dtoh_async(self.outputs[0]['host'], self.outputs[0]['device'], self.stream)
        self.stream.synchronize()

        # Reshape output
        output = self.outputs[0]['host'].reshape(self.outputs[0]['shape'])
        return [torch.from_numpy(output)]
