# Piksel

Free AI image tools that run in the browser: an upscaler (Real-ESRGAN) and a background remover (BiRefNet), powered by ONNX Runtime Web and WebGPU. Images are processed locally on your own GPU, so nothing is uploaded to a server, and there are no credits, watermarks, or daily limits. It adapts to your hardware automatically, from high-end GPUs down to older cards like the GTX 1050 Ti, with a CPU fallback for devices without WebGPU.

## Development

```sh
npm install
npm run dev
```

The home page (an overview of all tools) is at `/`, the upscaler at `/upscaler` (`/app` redirects there on Vercel), and the background remover at `/remove-background`. Each tool is its own page: an HTML entry in `vite.config.ts` plus an item in `src/content/tools.ts`. `404.html` is the "page not found" page. Vercel serves it for any URL that doesn't exist, and so do `npm run dev` and `npm run preview` (through a small plugin in `vite.config.ts`). Both tools need their AI model files (below) before they can run.

Full-size source artwork, such as the mascot PNGs, lives in `art/`. The site uses the smaller `.webp` copies in `src/assets/`, so export a new copy there when a picture changes.

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

### Background remover models

The background remover runs [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) (MIT) at its fixed 1024×1024 input. Generate the files from the official weights with `scripts/convert_birefnet.py` (its requirements are in the script). Don't use onnx-community's ready-made ONNX files: their deformable convolutions need about 10 GB to run, which fails in browsers. The script rewrites them to run in about 3 GB and checks every export against PyTorch.

```sh
python scripts/convert_birefnet.py
```

| File                      | Size   | Used for                                      |
| ------------------------- | ------ | --------------------------------------------- |
| `birefnet-lite.fp16.onnx` | 97 MB  | Fast                                          |
| `birefnet-lite.fp32.onnx` | 184 MB | Fast, on devices without fp16 WebGPU          |
| `birefnet.fp16.onnx`      | 472 MB | High quality (needs WebGPU with `shader-f16`) |
| `birefnet.fp32.onnx`      | 933 MB | Not used yet                                  |

### Hosting the models

By default the app loads models from `/models/` on the same site. To serve them from somewhere else, such as a Hugging Face repository or a CDN, set `VITE_MODEL_BASE_URL` (see `.env.example`) to the folder URL, ending in `/`. That server must send `Access-Control-Allow-Origin` headers, because the site is cross-origin isolated (see `vite.config.ts`).

Browsers download each model once and keep it in Cache Storage. If you replace the files at the same URLs, bump `modelCacheName` in `src/worker/engine.ts` so visitors fetch the new versions.

## Roadmap

Ideas for what to build next. Every tool should keep Piksel's promise: it runs on the visitor's device, nothing is uploaded, and it's free.

### Before launch

- [ ] Host the model files (Hugging Face is free and sends the needed CORS headers) and set `VITE_MODEL_BASE_URL` in Vercel.
- [ ] Replace the placeholder Ko-fi link (`kofiUrl` in `src/components/SiteFooter.tsx`).
- [ ] Add a license for the code. The footer has an "Open source" column, but the repo has no `LICENSE` file yet, so by default all rights are reserved.
- [ ] Include Real-ESRGAN's BSD-3 license and copyright notice wherever the model files are hosted; the license requires it when redistributing them.
- [ ] Connect a custom domain, ideally before promoting the site so shared links don't change.

### Small improvements

**Upscaler**

- [ ] Batch upscaling: queue several images and download them all as a ZIP.
- [ ] "Enhance only" (1×): clean up JPEG blockiness and noise without enlarging, by upscaling and shrinking back.
- [ ] Print size helper: pick a target like "A4 at 300 DPI" and Piksel chooses the scale.
- [ ] Copy the result to the clipboard, alongside Download.
- [ ] A zoom loupe on the before/after view, to inspect detail at 100%.

**Site and performance**

- [ ] Installable app (PWA) that works offline once a model is cached.
- [ ] Load onnxruntime's 27 MB WASM file from a public CDN such as jsDelivr, to cut the site's own bandwidth on Vercel's free plan.
- [ ] Privacy-friendly visitor stats with no cookies (Plausible or Umami).

**SEO**

- [ ] Pre-render the home page to static HTML, so crawlers and link previews see the content without running JavaScript.
- [ ] Open Graph and Twitter Card tags with a 1200×630 preview image, plus a canonical URL.
- [ ] Structured data (JSON-LD `WebApplication`).
- [ ] `robots.txt` and `sitemap.xml` in `public/`.
- [ ] Pages for specific uses, such as upscaling anime art, old photos, or images for print.

**Testing gaps**

- [ ] AMD and Intel GPUs (only tested on NVIDIA so far).
- [ ] Phones and tablets, including iOS Safari.
- [ ] The automatic retry with smaller tiles when the GPU runs out of memory (not yet triggered in testing).
- [ ] WebGPU in Firefox and Safari.

### New tools

Each tool gets its own page and an entry in `src/content/tools.ts`, and can reuse the model download and caching, the drop zone, and the before/after slider. Check each model's license before shipping it.

- [ ] **Background remover**: the page at `/remove-background` runs BiRefNet in a Web Worker (`src/worker/remover.worker.ts`). Still to do:
  - [x] Connect the models: Fast = BiRefNet lite, High quality = BiRefNet. Avoid Bria's RMBG models, which are non-commercial.
  - [ ] Optionally a top tier with [BiRefNet_HR](https://huggingface.co/ZhengPeng7/BiRefNet_HR) (2048×2048, MIT). It has no published ONNX file, needs converting (its deformable convolutions need `deform_conv2d_onnx_exporter`) and likely more GPU memory than browsers allow.
  - [x] Set `available: true` in `src/content/tools.ts` and link the home page card to the page.
  - [ ] An erase/restore brush to fix mistakes in the cut-out.
  - [ ] Batch processing.
- [ ] **Inpainting** (object eraser): brush over something and AI fills it in. The page at `/remove-objects` is built (brush, undo and redo, hold to compare, download), but `src/lib/objectEraser.ts` is a placeholder that blends nearby colors instead of running AI. Still to do:
  - [ ] Connect [LaMa](https://github.com/advimman/lama) (Apache-2.0) in a Web Worker. Its Fourier-transform layers need rewriting to run on WebGPU (see [this export](https://huggingface.co/imagingforgood/lama-512-onnx)), and it works on a 512×512 crop around the brushed area.
  - [ ] Set `available: true` in `src/content/tools.ts` and add the tool to the home page.
  - [ ] Optionally a Fast tier with [MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) (MIT), and click-to-select with SlimSAM.
  - [ ] Zoom and pan, for brushing small things precisely in large photos.
- [ ] **Face restoration** for old or blurry photos, pairing well with upscaling. [GFPGAN](https://github.com/TencentARC/GFPGAN) is the usual choice (check the license details); avoid CodeFormer, which is non-commercial.
- [ ] **Colorize black-and-white photos**, e.g. with [DeOldify](https://github.com/jantic/DeOldify) (MIT).
- [ ] **Face and license-plate blur**: automatically blur faces before sharing a photo, a natural fit for Piksel's privacy focus. [MediaPipe face detection](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector) is Apache-2.0; license plates need a separate detector.
- [ ] **Image to text (OCR)**: copy text out of screenshots and photos with [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0).
- [ ] **Portrait blur**: blur the background by distance, like a phone's portrait mode, using [Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) (Apache-2.0). Its larger versions are non-commercial.
- [ ] **Video and GIF upscaling** with `realesr-animevideov3` and WebCodecs. The most ambitious idea here.
