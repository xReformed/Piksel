// Content for the upscaler page (/upscaler).
import type { FaqItem } from '../components/Faq.tsx'
import type { Feature } from '../components/Features.tsx'
import type { Step } from '../components/HowItWorks.tsx'
import {
  ChipIcon,
  DownloadIcon,
  ImageIcon,
  InfinityIcon,
  LaptopIcon,
  LayersIcon,
  LockIcon,
  MaximizeIcon,
  UploadIcon,
} from '../components/icons.tsx'

export const upscalerFeatures: Feature[] = [
  {
    Icon: LockIcon,
    title: 'Private by design',
    description:
      'Your images never leave your device. Everything runs in your browser, so nothing is uploaded.',
  },
  {
    Icon: ChipIcon,
    title: 'Powered by your GPU',
    description: 'WebGPU runs the AI on your own graphics card for fast, high-quality results.',
  },
  {
    Icon: ImageIcon,
    title: 'Up to 4× the resolution',
    description: 'Real-ESRGAN restores sharp edges, texture and fine detail at 2× or 4×.',
  },
  {
    Icon: InfinityIcon,
    title: 'Free, with no limits',
    description: 'No credits, no watermarks and no daily caps. Upscale as many images as you like.',
  },
  {
    Icon: LaptopIcon,
    title: 'Works on your hardware',
    description:
      "Adapts to your GPU, from the latest cards down to a GTX 1050 Ti, with a CPU fallback when WebGPU isn't available.",
  },
  {
    Icon: LayersIcon,
    title: 'Made for photos and art',
    description: 'Pick a model tuned for photos, or one built for anime and illustrations.',
  },
]

export const upscalerSteps: Step[] = [
  {
    Icon: UploadIcon,
    title: 'Drop your image',
    description: 'Drag in a PNG, JPG or WebP, or click to browse your files.',
  },
  {
    Icon: MaximizeIcon,
    title: 'Choose a size',
    description: "Pick 2× or 4×, and tell Piksel whether it's a photo or artwork.",
  },
  {
    Icon: DownloadIcon,
    title: 'Download the result',
    description: 'Compare the before and after, then save the sharper version.',
  },
]

export const upscalerFaqs: FaqItem[] = [
  {
    question: 'Which AI model does the upscaler use?',
    answer:
      'Real-ESRGAN, an open-source model built for restoring real-world photos, plus versions trained on anime and illustrations. Auto picks the right one for your image and hardware, or you can choose one yourself in Advanced settings.',
  },
  {
    question: 'Should I pick 2× or 4×?',
    answer:
      '2× is faster and makes smaller files, which is plenty for screens and social media. 4× recovers the most detail, which helps when printing or cropping in close.',
  },
  {
    question: 'Why does the first upscale take longer?',
    answer:
      "The first time, your browser downloads the AI model. It's saved for next time, so later upscales start right away.",
  },
  {
    question: "What's the largest image I can upscale?",
    answer:
      "It depends on your device's memory. A 4× upscale gives an image 16 times as many pixels, so very large images may only work at 2×. Piksel warns you before starting if an image is too big.",
  },
  {
    question: 'Which file formats are supported?',
    answer:
      'You can upscale PNG, JPG and WebP images, and save the result in any of those formats.',
  },
]
