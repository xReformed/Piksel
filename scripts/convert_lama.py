"""Convert the official big-lama weights to ONNX for Piksel's object eraser.

LaMa (Apache-2.0, github.com/advimman/lama) fills in masked areas of an image. Its Fast Fourier
Convolutions use FFTs, which onnxruntime-web can't run on the GPU, so here each FFT is rewritten
as matrix multiplications with fixed cosine and sine matrices (exact for a fixed input size), so
each file has one input size. The app uses `lama.fp32.onnx` at 512×512: it gives the same output
as the Carve/LaMa-ONNX export, pixel for pixel, with a quarter of the nodes and no Einsum.

Other sizes can be exported (`lama-<size>.fp32.onnx`), but bigger isn't better: on a 4096×2732
photo, 1024 filled hair as a flat smear and spread a print's dark color where 512 continued the
strands and the fabric (big-lama was trained on 256 px crops), and it ran 4.5× slower.

The network is rebuilt here from LaMa's `saicinpainting/training/modules/ffc.py` design, with the
same layer names, so the checkpoint loads into it directly; LaMa's own code isn't needed. The
checkpoint is read with a restricted unpickler that only lets tensors through.

Inputs and output match the Carve/LaMa-ONNX export the app was first built with:
    image  float32 [1, 3, S, S]  RGB from 0 to 1
    mask   float32 [1, 1, S, S]  1 where the image should be filled in
    output float32 [1, 3, S, S]  RGB from 0 to 255, the original outside the mask

Each export is checked against the same network using real FFTs before it is written.

Requirements (the same virtual environment as convert_birefnet.py):
    pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
    pip install onnx onnxruntime numpy

Usage (big-lama.zip from huggingface.co/smartywu/big-lama, the LaMa README's download link):
    python scripts/convert_lama.py big-lama.zip [--out public/models] [--sizes 512]
"""

import argparse
import collections
import io
import math
import pickle
import types
import zipfile
from pathlib import Path

import numpy as np
import onnxruntime
import torch
from torch import nn

# --- Reading the checkpoint without running anything in it ------------------------------------


class _Ignored(dict):
    """Stands in for any class in the checkpoint other than tensors (training callbacks, configs).
    A dict, so the pickle can fill it in, but nothing it does has any effect."""

    def __init__(self, *args, **kwargs):
        pass

    def __setstate__(self, state):
        pass

    def append(self, item):
        pass

    def extend(self, items):
        pass


_ALLOWED = {
    ("collections", "OrderedDict"): collections.OrderedDict,
    ("collections", "defaultdict"): collections.defaultdict,
    ("torch._utils", "_rebuild_tensor_v2"): torch._utils._rebuild_tensor_v2,
    ("torch._utils", "_rebuild_parameter"): torch._utils._rebuild_parameter,
    ("torch", "Size"): torch.Size,
    ("builtins", "set"): set,
}


class _SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) in _ALLOWED:
            return _ALLOWED[(module, name)]
        if module == "torch" and name.endswith("Storage"):
            return getattr(torch, name)
        return type(name, (_Ignored,), {})


_safe_pickle = types.SimpleNamespace(
    Unpickler=_SafeUnpickler,
    load=lambda file, **kwargs: _SafeUnpickler(file, **kwargs).load(),
    __name__="safe_pickle",
)


def load_generator_weights(zip_path: Path) -> dict[str, torch.Tensor]:
    with zipfile.ZipFile(zip_path) as archive:
        checkpoint = io.BytesIO(archive.read("big-lama/models/best.ckpt"))
    state = torch.load(checkpoint, map_location="cpu", weights_only=False, pickle_module=_safe_pickle)
    prefix = "generator."
    return {k[len(prefix) :]: v for k, v in state["state_dict"].items() if k.startswith(prefix)}


# --- FFTs as matrix multiplications -----------------------------------------------------------


class Dft2d(nn.Module):
    """rfftn and irfftn over the last two dimensions (norm="ortho") for a fixed size, as matrix
    multiplications. Real and imaginary parts are kept as separate tensors."""

    def __init__(self, height: int, width: int):
        super().__init__()
        bins = width // 2 + 1
        h = torch.arange(height, dtype=torch.float64)
        w = torch.arange(width, dtype=torch.float64)
        k = torch.arange(bins, dtype=torch.float64)
        angle_h = 2 * math.pi * torch.outer(h, h) / height  # [m, h]
        angle_w = 2 * math.pi * torch.outer(w, k) / width  # [w, k]
        scale_h = 1 / math.sqrt(height)
        scale_w = 1 / math.sqrt(width)
        # Forward: along the width (real input), then along the height (complex).
        self.register_buffer("cos_w", (torch.cos(angle_w) * scale_w).float())
        self.register_buffer("sin_w", (torch.sin(angle_w) * scale_w).float())
        self.register_buffer("cos_h", (torch.cos(angle_h) * scale_h).float())
        self.register_buffer("sin_h", (torch.sin(angle_h) * scale_h).float())
        # Inverse along the width from the `bins` half spectrum: every bin but the first (and the
        # last, for even widths) stands for two, itself and its mirror image.
        weight = torch.full((bins,), 2.0, dtype=torch.float64)
        weight[0] = 1
        if width % 2 == 0:
            weight[-1] = 1
        angle_inverse = 2 * math.pi * torch.outer(k, w) / width  # [k, w]
        self.register_buffer("icos_w", (torch.cos(angle_inverse) * weight[:, None] * scale_w).float())
        self.register_buffer("isin_w", (torch.sin(angle_inverse) * weight[:, None] * scale_w).float())

    def forward(self, x):
        real = x @ self.cos_w
        imag = -(x @ self.sin_w)
        return (
            self.cos_h @ real + self.sin_h @ imag,
            self.cos_h @ imag - self.sin_h @ real,
        )

    def inverse(self, real, imag):
        # The height matrices are symmetric, so the inverse uses them as they are.
        real_h = self.cos_h @ real - self.sin_h @ imag
        imag_h = self.cos_h @ imag + self.sin_h @ real
        return real_h @ self.icos_w - imag_h @ self.isin_w


# --- The network, after LaMa's ffc.py, with its layer names ------------------------------------


class FourierUnit(nn.Module):
    def __init__(self, channels: int, size: int | None):
        super().__init__()
        self.conv_layer = nn.Conv2d(channels * 2, channels * 2, 1, bias=False)
        self.bn = nn.BatchNorm2d(channels * 2)
        self.relu = nn.ReLU(inplace=True)
        # None uses torch.fft (the reference); a size uses the matrix version.
        self.dft = Dft2d(size, size) if size else None

    def forward(self, x):
        batch, channels, height, width = x.shape
        if self.dft is None:
            spectrum = torch.fft.rfftn(x, dim=(-2, -1), norm="ortho")
            real, imag = spectrum.real, spectrum.imag
        else:
            real, imag = self.dft(x)
        # Interleave real and imaginary parts per channel, as LaMa does.
        stacked = torch.stack((real, imag), dim=2).reshape(batch, channels * 2, height, -1)
        stacked = self.relu(self.bn(self.conv_layer(stacked)))
        stacked = stacked.reshape(batch, channels, 2, height, -1)
        real, imag = stacked[:, :, 0], stacked[:, :, 1]
        if self.dft is None:
            return torch.fft.irfftn(torch.complex(real, imag), s=(height, width), dim=(-2, -1), norm="ortho")
        return self.dft.inverse(real, imag)


class SpectralTransform(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, size: int | None):
        super().__init__()
        self.conv1 = nn.Sequential(
            nn.Conv2d(in_channels, out_channels // 2, 1, bias=False),
            nn.BatchNorm2d(out_channels // 2),
            nn.ReLU(inplace=True),
        )
        self.fu = FourierUnit(out_channels // 2, size)
        self.conv2 = nn.Conv2d(out_channels // 2, out_channels, 1, bias=False)

    def forward(self, x):
        x = self.conv1(x)
        return self.conv2(x + self.fu(x))


class FFC(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, ratio_gin, ratio_gout, stride, padding, size):
        super().__init__()
        in_g = int(in_channels * ratio_gin)
        in_l = in_channels - in_g
        out_g = int(out_channels * ratio_gout)
        out_l = out_channels - out_g
        self.ratio_gout = ratio_gout

        def conv(cin, cout):
            if cin == 0 or cout == 0:
                return None
            return nn.Conv2d(cin, cout, kernel_size, stride, padding, bias=False, padding_mode="reflect")

        self.convl2l = conv(in_l, out_l)
        self.convl2g = conv(in_l, out_g)
        self.convg2l = conv(in_g, out_l)
        self.convg2g = SpectralTransform(in_g, out_g, size) if in_g and out_g else None

    def forward(self, x_l, x_g):
        out_l = out_g = None
        if self.ratio_gout != 1:
            out_l = self.convl2l(x_l)
            if self.convg2l is not None:
                out_l = out_l + self.convg2l(x_g)
        if self.ratio_gout != 0:
            out_g = self.convl2g(x_l)
            if self.convg2g is not None:
                out_g = out_g + self.convg2g(x_g)
        return out_l, out_g


class FFC_BN_ACT(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, ratio_gin, ratio_gout, stride=1, padding=0, size=None):
        super().__init__()
        self.ffc = FFC(in_channels, out_channels, kernel_size, ratio_gin, ratio_gout, stride, padding, size)
        out_g = int(out_channels * ratio_gout)
        self.bn_l = nn.BatchNorm2d(out_channels - out_g) if ratio_gout != 1 else None
        self.bn_g = nn.BatchNorm2d(out_g) if ratio_gout != 0 else None

    def forward(self, x_l, x_g=None):
        x_l, x_g = self.ffc(x_l, x_g)
        if x_l is not None:
            x_l = torch.relu(self.bn_l(x_l))
        if x_g is not None:
            x_g = torch.relu(self.bn_g(x_g))
        return x_l, x_g


class FFCResnetBlock(nn.Module):
    def __init__(self, channels: int, size: int | None):
        super().__init__()
        self.conv1 = FFC_BN_ACT(channels, channels, 3, 0.75, 0.75, padding=1, size=size)
        self.conv2 = FFC_BN_ACT(channels, channels, 3, 0.75, 0.75, padding=1, size=size)

    def forward(self, x_l, x_g):
        y_l, y_g = self.conv1(x_l, x_g)
        y_l, y_g = self.conv2(y_l, y_g)
        return x_l + y_l, x_g + y_g


class Generator(nn.Module):
    """big-lama's FFCResNetGenerator: ngf 64, 3 downsamplings, 18 FFC blocks (75% global),
    3 upsamplings, sigmoid output. `model.<i>` indices match the checkpoint."""

    def __init__(self, input_size: int | None):
        super().__init__()
        # The FFC blocks work at 1/8 of the input size.
        bottleneck = input_size // 8 if input_size else None
        layers: dict[str, nn.Module] = {
            "0": nn.ReflectionPad2d(3),
            "1": FFC_BN_ACT(4, 64, 7, 0, 0),
            "2": FFC_BN_ACT(64, 128, 3, 0, 0, stride=2, padding=1),
            "3": FFC_BN_ACT(128, 256, 3, 0, 0, stride=2, padding=1),
            "4": FFC_BN_ACT(256, 512, 3, 0, 0.75, stride=2, padding=1),
        }
        for i in range(18):
            layers[str(5 + i)] = FFCResnetBlock(512, bottleneck)
        index = 24  # 23 is LaMa's ConcatTupleLayer, done in forward
        for channels in (512, 256, 128):
            layers[str(index)] = nn.ConvTranspose2d(channels, channels // 2, 3, 2, 1, output_padding=1)
            layers[str(index + 1)] = nn.BatchNorm2d(channels // 2)
            layers[str(index + 2)] = nn.ReLU(inplace=True)
            index += 3
        layers["33"] = nn.ReflectionPad2d(3)
        layers["34"] = nn.Conv2d(64, 3, 7)
        self.model = nn.ModuleDict(layers)

    def forward(self, x):
        m = self.model
        x_l, x_g = m["1"](m["0"](x))
        for i in (2, 3, 4):
            x_l, x_g = m[str(i)](x_l, x_g)
        for i in range(5, 23):
            x_l, x_g = m[str(i)](x_l, x_g)
        x = torch.cat([x_l, x_g], dim=1)
        for i in range(24, 33):
            x = m[str(i)](x)
        return torch.sigmoid(m["34"](m["33"](x)))


class Inpainter(nn.Module):
    """What the app runs: LaMa's input preparation and output blending around the generator."""

    def __init__(self, generator: Generator):
        super().__init__()
        self.generator = generator

    def forward(self, image, mask):
        mask = (mask > 0.5).float()
        known = image * (1 - mask)
        predicted = self.generator(torch.cat([known, mask], dim=1))
        result = mask * predicted + (1 - mask) * image
        return torch.clamp(result * 255, 0, 255)


def build(weights: dict[str, torch.Tensor], input_size: int | None) -> Inpainter:
    generator = Generator(input_size)
    # The matrix buffers aren't in the checkpoint; everything else must be.
    missing, unexpected = generator.load_state_dict(weights, strict=False)
    missing = [k for k in missing if ".dft." not in k]
    if missing or unexpected:
        raise SystemExit(f"Checkpoint mismatch.\nMissing: {missing[:10]}\nUnexpected: {unexpected[:10]}")
    return Inpainter(generator).eval()


def sample_inputs(size: int) -> tuple[torch.Tensor, torch.Tensor]:
    """A smooth test image with structure at several scales, and a blob plus a stroke to fill."""
    y, x = torch.meshgrid(torch.linspace(0, 1, size), torch.linspace(0, 1, size), indexing="ij")
    image = torch.stack(
        [
            0.5 + 0.4 * torch.sin(12 * x + 3 * y),
            0.5 + 0.4 * torch.cos(7 * y - 5 * x),
            0.5 + 0.3 * torch.sin(30 * x * y),
        ]
    )[None]
    mask = (((x - 0.45) ** 2 + (y - 0.5) ** 2) < 0.03).float()
    mask = torch.maximum(mask, ((abs(y - 0.25) < 0.02) & (x > 0.2) & (x < 0.8)).float())
    return image.clamp(0, 1), mask[None, None]


def export(weights, size: int, out_dir: Path) -> Path:
    name = "lama.fp32.onnx" if size == 512 else f"lama-{size}.fp32.onnx"
    path = out_dir / name
    model = build(weights, size)
    image, mask = sample_inputs(size)

    print(f"{name}: checking the matrix FFTs against torch.fft…")
    reference = build(weights, None)
    with torch.no_grad():
        expected = reference(image, mask).numpy()
        ours = model(image, mask).numpy()
    print(f"  largest difference from torch.fft: {np.abs(expected - ours).max():.4f} (of 255)")

    print(f"{name}: exporting…")
    with torch.no_grad():
        torch.onnx.export(
            model,
            (image, mask),
            str(path),
            input_names=["image", "mask"],
            output_names=["output"],
            opset_version=17,
            dynamo=False,
        )

    session = onnxruntime.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"image": image.numpy(), "mask": mask.numpy()})[0]
    difference = np.abs(expected - actual).max()
    print(f"  largest difference of the ONNX file from torch.fft: {difference:.4f} (of 255)")
    if difference > 2:
        raise SystemExit(f"{name} doesn't match the reference; not keeping it.")
    print(f"  wrote {path} ({path.stat().st_size / 1e6:.0f} MB)")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("checkpoint", type=Path, help="big-lama.zip")
    parser.add_argument("--out", type=Path, default=Path("public/models"))
    parser.add_argument("--sizes", type=int, nargs="+", default=[512])
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    weights = load_generator_weights(args.checkpoint)
    for size in args.sizes:
        if size % 8:
            raise SystemExit("Sizes must be multiples of 8.")
        export(weights, size, args.out)


if __name__ == "__main__":
    main()
