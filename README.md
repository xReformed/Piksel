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

## Roadmap

Ideas for what to build next. Every tool should keep Piksel's promise: it runs on the visitor's device, nothing is uploaded, and it's free.

### Before launch

- [ ] Host the model files (Hugging Face is free and sends the needed CORS headers) and set `VITE_MODEL_BASE_URL` in Vercel.
- [ ] Replace the placeholder Ko-fi link (`kofiUrl` in `src/components/SiteFooter.tsx`).
- [ ] Add a license for the code. The footer has an "Open source" column, but the repo has no `LICENSE` file yet, so by default all rights are reserved.
- [ ] Include Real-ESRGAN's BSD-3 license and copyright notice wherever the model files are hosted; the license requires it when redistributing them.
- [ ] Connect a custom domain, ideally before promoting the site so shared links don't change.
- [ ] Decide on the Examples section (`src/components/Examples.tsx` and `src/assets/examples/`): show it on the home page, or delete it. It's currently unused.

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

- [ ] **Background remover**: already listed as "Coming soon". [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) is MIT-licensed; avoid Bria's RMBG models, which are non-commercial.
- [ ] **Object eraser**: brush over something and AI fills it in. [LaMa](https://github.com/advimman/lama) is Apache-2.0 and is known to run in browsers.
- [ ] **Face restoration** for old or blurry photos, pairing well with upscaling. [GFPGAN](https://github.com/TencentARC/GFPGAN) is the usual choice (check the license details); avoid CodeFormer, which is non-commercial.
- [ ] **Colorize black-and-white photos**, e.g. with [DeOldify](https://github.com/jantic/DeOldify) (MIT).
- [ ] **Format converter**: HEIC to JPG, PNG to WebP or AVIF. No AI needed, and people search for it constantly.
- [ ] **Image compressor and resizer**: also no AI, and good for bringing in visitors who then find the other tools.
- [ ] **Video and GIF upscaling** with `realesr-animevideov3` and WebCodecs. The most ambitious idea here.
