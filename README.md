# Piksel

A browser-based AI image upscaler powered by Real-ESRGAN, ONNX Runtime Web, and WebGPU. Images are processed locally on your own GPU, so nothing is uploaded to a server, and there are no credits, watermarks, or daily limits. It adapts to your hardware automatically, from high-end GPUs down to older cards like the GTX 1050 Ti, with a CPU fallback for devices without WebGPU.

## Development

```sh
npm install
npm run dev
```

The home page (an overview of all tools) is at `/` and the upscaler at `/upscaler`; `/app` redirects there on Vercel. Each tool is its own page: an HTML entry in `vite.config.ts` plus an item in `src/content/tools.ts`. The upscaler needs the AI model files (below) before it can run.

## AI models

The model files are not in the repository (they total about 250 MB). Generate them from the official [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) weights (BSD-3-Clause) with:

```sh
python -m venv .venv
.venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
pip install onnx onnxscript onnxconverter-common onnxruntime numpy
python scripts/convert_models.py
```

This writes `<model>.fp32.onnx` and `<model>.fp16.onnx` files to `public/models/`, which the dev server serves at `/models/`. The script checks every export against PyTorch before saving it.

### Hosting the models

By default the app loads models from `/models/` on the same site. To serve them from somewhere else, such as a Hugging Face repository or a CDN, set `VITE_MODEL_BASE_URL` (see `.env.example`) to the folder URL, ending in `/`. That server must send `Access-Control-Allow-Origin` headers, because the site is cross-origin isolated (see `vite.config.ts`).

Browsers download each model once and keep it in Cache Storage. If you replace the files at the same URLs, bump `modelCacheName` in `src/worker/upscale.worker.ts` so visitors fetch the new versions.
