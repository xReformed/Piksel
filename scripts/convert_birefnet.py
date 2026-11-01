"""Convert the official BiRefNet weights to ONNX for Piksel's background remover.

Loads the MIT-licensed models from Hugging Face (ZhengPeng7/BiRefNet_lite and ZhengPeng7/BiRefNet,
including their model code) and exports each at its 1024×1024 input as `<name>.fp32.onnx` and
`<name>.fp16.onnx` (fp16 weights, float32 input and output). The output is the raw score (logit)
of the subject mask; the app applies the sigmoid.

Why not use onnx-community's ready-made exports: their deformable convolutions (in the decoder's
ASPP blocks) were expanded into gathers over all kernel positions at once, which creates 800 MB
tensors and needs ~10 GB to run, more than browsers allow. Here each deformable convolution is
rewritten as one bilinear GridSample and 1×1 convolution per kernel position, which computes the
same result in a fraction of the memory. Each export is checked against the original PyTorch model
with onnxruntime before it is written.

The file names must match `removerModels` in `src/lib/backgroundRemover.ts`.

Requirements (use a virtual environment, alongside those of convert_models.py):
    pip install torch==2.14.1 torchvision --index-url https://download.pytorch.org/whl/cpu
    pip install transformers timm einops kornia safetensors huggingface_hub
    pip install onnx onnxscript onnxruntime numpy

Usage:
    python scripts/convert_birefnet.py [--out public/models] [--only birefnet-lite]
"""

import argparse
import types
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
import torch
from onnxruntime.transformers.float16 import convert_float_to_float16
from onnxruntime.transformers.onnx_model import OnnxModel
from torch.nn import functional as F
from torchvision.ops import deform_conv2d
from transformers import AutoModelForImageSegmentation

MODELS = {
    "birefnet-lite": "ZhengPeng7/BiRefNet_lite",
    "birefnet": "ZhengPeng7/BiRefNet",
}
SIZE = 1024
# ImageNet statistics, which BiRefNet's input is normalized with.
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


# --- Memory-efficient deformable convolution ----------------------------------------------------


def deform_conv2d_by_sampling(x, offset, mask, weight, bias, padding):
    """torchvision's deform_conv2d (stride 1, no dilation, one offset group), one kernel position
    at a time: sample the input at the offset positions with GridSample, weight it by the mask, and
    add that position's share of the convolution."""
    _, _, height, width = x.shape
    _, _, kernel_h, kernel_w = weight.shape
    ys = torch.arange(height, dtype=x.dtype).view(1, height, 1)
    xs = torch.arange(width, dtype=x.dtype).view(1, 1, width)
    out = None
    for i in range(kernel_h):
        for j in range(kernel_w):
            k = i * kernel_w + j
            # Sample positions in pixels; offset channels are (y, x) pairs per kernel position.
            py = ys - padding + i + offset[:, 2 * k]
            px = xs - padding + j + offset[:, 2 * k + 1]
            grid = torch.stack((2 * px / (width - 1) - 1, 2 * py / (height - 1) - 1), dim=-1)
            sampled = F.grid_sample(
                x, grid, mode="bilinear", padding_mode="zeros", align_corners=True
            )
            term = F.conv2d(sampled * mask[:, k : k + 1], weight[:, :, i : i + 1, j : j + 1])
            out = term if out is None else out + term
    if bias is not None:
        out = out + bias.view(1, -1, 1, 1)
    return out


def sampling_forward(self, x):
    """Replaces DeformableConv2d.forward in BiRefNet's model code."""
    assert self.stride == (1, 1), "only stride 1 is supported"
    offset = self.offset_conv(x)
    modulator = 2.0 * torch.sigmoid(self.modulator_conv(x))
    return deform_conv2d_by_sampling(
        x, offset, modulator, self.regular_conv.weight, self.regular_conv.bias, self.padding
    )


def check_sampling():
    """Compare the rewrite with torchvision on random inputs, offsets reaching past the edges."""
    torch.manual_seed(0)
    for kernel in (1, 3, 7):
        x = torch.randn(1, 8, 19, 23)
        offset = torch.randn(1, 2 * kernel * kernel, 19, 23) * 4
        mask = torch.rand(1, kernel * kernel, 19, 23) * 2
        weight = torch.randn(5, 8, kernel, kernel)
        bias = torch.randn(5)
        padding = kernel // 2
        expected = deform_conv2d(x, offset, weight, bias, padding=padding, mask=mask)
        actual = deform_conv2d_by_sampling(x, offset, mask, weight, bias, padding)
        difference = float((expected - actual).abs().max())
        if difference > 1e-4:
            raise SystemExit(f"deformable convolution rewrite differs by {difference} ({kernel}×{kernel})")


# --- Conversion -------------------------------------------------------------------------------------


class Exported(torch.nn.Module):
    """BiRefNet's last (full-resolution) prediction, as raw scores."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x):
        return self.model(x)[-1]


def sample_input():
    """A smooth, photo-like input: random noise would make the subject mask meaningless."""
    torch.manual_seed(1)
    image = F.interpolate(torch.rand(1, 3, 16, 16), size=(SIZE, SIZE), mode="bicubic").clamp(0, 1)
    return (image - MEAN) / STD


def convert(name, repo, out_dir):
    model = AutoModelForImageSegmentation.from_pretrained(repo, trust_remote_code=True)
    model.eval().float()
    sample = sample_input()
    with torch.no_grad():
        expected = Exported(model)(sample).numpy()

    patched = 0
    for module in model.modules():
        if type(module).__name__ == "DeformableConv2d":
            module.forward = types.MethodType(sampling_forward, module)
            patched += 1
    if not patched:
        raise SystemExit(f"{repo}: found no deformable convolutions to rewrite")

    fp32_path = out_dir / f"{name}.fp32.onnx"
    with torch.no_grad():
        torch.onnx.export(
            Exported(model),
            (sample,),
            str(fp32_path),
            input_names=["input_image"],
            output_names=["output_image"],
            opset_version=17,
            dynamo=False,
        )

    session = onnxruntime.InferenceSession(str(fp32_path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"input_image": sample.numpy()})[0]
    difference = float(np.abs(actual - expected).max())
    # Compare the masks themselves (after the sigmoid), which is what the app uses.
    mask_difference = float(np.abs(sigmoid(actual) - sigmoid(expected)).max())
    if actual.shape != expected.shape or mask_difference > 1e-3:
        raise SystemExit(
            f"{fp32_path.name}: output mismatch (shape {actual.shape}, mask diff {mask_difference})"
        )

    fp16_path = out_dir / f"{name}.fp16.onnx"
    convert_fp16(fp32_path, fp16_path)
    session = onnxruntime.InferenceSession(str(fp16_path), providers=["CPUExecutionProvider"])
    actual16 = session.run(None, {"input_image": sample.numpy()})[0]
    mask_difference16 = float(np.abs(sigmoid(actual16) - sigmoid(expected)).max())
    if mask_difference16 > 0.1:
        raise SystemExit(f"{fp16_path.name}: output mismatch (mask diff {mask_difference16})")

    sizes = ", ".join(f"{p.name} {p.stat().st_size / 1e6:.0f} MB" for p in (fp32_path, fp16_path))
    print(f"  {sizes} ({patched} deformable convolutions rewritten; vs PyTorch: fp32 score diff "
          f"{difference:.1e}, mask diff fp32 {mask_difference:.1e}, fp16 {mask_difference16:.1e})")


def convert_fp16(fp32_path, fp16_path):
    """fp16 weights, float32 input and output. Uses onnxruntime's converter: onnxconverter-common's
    leaves Cast-to-float nodes (in the backbone's shape arithmetic) disagreeing with their
    fp16-typed outputs, so the model fails to load."""
    model = convert_float_to_float16(onnx.load(str(fp32_path)), keep_io_types=True)
    # The converter appends its input Cast at the end; ONNX wants nodes in dependency order.
    OnnxModel(model).topological_sort()
    onnx.save(model, str(fp16_path))
    onnx.checker.check_model(str(fp16_path))


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "public" / "models")
    parser.add_argument("--only", choices=list(MODELS), help="convert just this model")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    check_sampling()
    for name, repo in MODELS.items():
        if args.only and name != args.only:
            continue
        print(name)
        convert(name, repo, args.out)
    print(f"Done. Models are in {args.out}")


if __name__ == "__main__":
    main()
