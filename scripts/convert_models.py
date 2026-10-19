"""Convert the official Real-ESRGAN weights to ONNX for Piksel.

Downloads the BSD-3-licensed PyTorch weights from the Real-ESRGAN GitHub releases, rebuilds the
networks (architectures as defined in BasicSR / Real-ESRGAN) and exports every model Piksel offers
to ONNX, as `<name>.fp32.onnx` and `<name>.fp16.onnx` (fp16 weights, float32 inputs and outputs).
Each export is checked against PyTorch with onnxruntime before it is written.

The file names must match `src/lib/models.ts`.

Requirements (use a virtual environment). Tested with torch 2.14.1; the export uses the
TorchScript-based exporter, which PyTorch plans to remove in a later release:
    pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
    pip install onnx onnxscript onnxconverter-common onnxruntime numpy

Usage:
    python scripts/convert_models.py [--out public/models]
"""

import argparse
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
import torch
from onnxconverter_common import float16
from torch import nn
from torch.nn import functional as F

RELEASES = "https://github.com/xinntao/Real-ESRGAN/releases/download"
WEIGHTS = {
    "x4plus": f"{RELEASES}/v0.1.0/RealESRGAN_x4plus.pth",
    "x2plus": f"{RELEASES}/v0.2.1/RealESRGAN_x2plus.pth",
    "x4plus_anime_6B": f"{RELEASES}/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
    "general_x4v3": f"{RELEASES}/v0.2.5.0/realesr-general-x4v3.pth",
    "general_wdn_x4v3": f"{RELEASES}/v0.2.5.0/realesr-general-wdn-x4v3.pth",
    "animevideov3": f"{RELEASES}/v0.2.5.0/realesr-animevideov3.pth",
}

# realesr-general-x4v3's denoise strength is a blend of its weights with the "weak denoise" (wdn)
# model, as Real-ESRGAN's --denoise_strength does. Piksel ships these levels (percent).
DENOISE_LEVELS = [0, 25, 50, 100]


# --- Architectures (from BasicSR / Real-ESRGAN, BSD-3-Clause) -------------------------------------


def pixel_unshuffle(x, scale):
    b, c, hh, hw = x.size()
    h, w = hh // scale, hw // scale
    x_view = x.view(b, c, h, scale, w, scale)
    return x_view.permute(0, 1, 3, 5, 2, 4).reshape(b, c * scale * scale, h, w)


class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat=64, num_grow_ch=32):
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, num_feat, num_grow_ch=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x):
        out = self.rdb3(self.rdb2(self.rdb1(x)))
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, scale=4, num_feat=64, num_block=23, num_grow_ch=32):
        super().__init__()
        self.scale = scale
        num_in_ch = 3 * {4: 1, 2: 4, 1: 16}[scale]
        self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = x if self.scale == 4 else pixel_unshuffle(x, 4 // self.scale)
        feat = self.conv_first(feat)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


class SRVGGNetCompact(nn.Module):
    def __init__(self, num_feat=64, num_conv=16, upscale=4):
        super().__init__()
        self.upscale = upscale
        self.body = nn.ModuleList([nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)])
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
        self.body.append(nn.Conv2d(num_feat, 3 * upscale * upscale, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        return out + F.interpolate(x, scale_factor=self.upscale, mode="nearest")


# --- Conversion -------------------------------------------------------------------------------------


def load_state(path):
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    return checkpoint["params_ema"] if "params_ema" in checkpoint else checkpoint["params"]


def download(name, weights_dir):
    path = weights_dir / Path(WEIGHTS[name]).name
    if not path.exists():
        print(f"  downloading {path.name}")
        urllib.request.urlretrieve(WEIGHTS[name], path)
    return path


def export(model, path, input_multiple):
    model.eval()
    sample = torch.rand(1, 3, 12 * input_multiple, 10 * input_multiple)
    torch.onnx.export(
        model,
        (sample,),
        str(path),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {2: "height", 3: "width"}, "output": {2: "out_height", 3: "out_width"}},
        opset_version=17,
        dynamo=False,
    )


def check(model, path, input_multiple, tolerance):
    """Compare onnxruntime's output with PyTorch's on an input of a different size than the export."""
    sample = torch.rand(1, 3, 17 * input_multiple, 23 * input_multiple)
    with torch.no_grad():
        expected = model(sample).numpy()
    session = onnxruntime.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"input": sample.numpy()})[0]
    difference = float(np.abs(actual - expected).max())
    if actual.shape != expected.shape or difference > tolerance:
        raise SystemExit(f"{path.name}: output mismatch (shape {actual.shape}, max diff {difference})")
    return difference


def convert(name, model, out_dir, input_multiple=1):
    fp32_path = out_dir / f"{name}.fp32.onnx"
    export(model, fp32_path, input_multiple)
    difference = check(model, fp32_path, input_multiple, tolerance=1e-3)

    fp16_path = out_dir / f"{name}.fp16.onnx"
    fp16_model = float16.convert_float_to_float16(onnx.load(str(fp32_path)), keep_io_types=True)
    onnx.save(fp16_model, str(fp16_path))
    onnx.checker.check_model(str(fp16_path))

    sizes = ", ".join(f"{p.name} {p.stat().st_size / 1e6:.1f} MB" for p in (fp32_path, fp16_path))
    print(f"  {sizes} (fp32 max diff vs PyTorch {difference:.1e})")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "public" / "models")
    parser.add_argument("--weights", type=Path, default=Path(tempfile.gettempdir()) / "piksel-weights")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    args.weights.mkdir(parents=True, exist_ok=True)

    def rrdb(weights, **options):
        model = RRDBNet(**options)
        model.load_state_dict(load_state(download(weights, args.weights)), strict=True)
        return model

    def compact(state, num_conv):
        model = SRVGGNetCompact(num_conv=num_conv)
        model.load_state_dict(state, strict=True)
        return model

    print("realesrgan-x4plus")
    convert("realesrgan-x4plus", rrdb("x4plus", scale=4), args.out)
    print("realesrgan-x2plus")
    convert("realesrgan-x2plus", rrdb("x2plus", scale=2), args.out, input_multiple=2)
    print("realesrgan-x4plus-anime-6b")
    convert("realesrgan-x4plus-anime-6b", rrdb("x4plus_anime_6B", scale=4, num_block=6), args.out)

    general = load_state(download("general_x4v3", args.weights))
    general_wdn = load_state(download("general_wdn_x4v3", args.weights))
    for level in DENOISE_LEVELS:
        strength = level / 100
        blended = {key: strength * general[key] + (1 - strength) * general_wdn[key] for key in general}
        print(f"realesr-general-x4v3-dn{level}")
        convert(f"realesr-general-x4v3-dn{level}", compact(blended, num_conv=32), args.out)

    print("realesr-animevideov3")
    convert("realesr-animevideov3", compact(load_state(download("animevideov3", args.weights)), 16), args.out)
    print(f"Done. Models are in {args.out}")


if __name__ == "__main__":
    main()
