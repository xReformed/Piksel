// Content for the home page (/), which covers every tool.
import type { FaqItem } from '../components/Faq.tsx'
import type { Step } from '../components/HowItWorks.tsx'
import { DownloadIcon, LayersIcon, UploadIcon } from '../components/icons.tsx'

export const homeSteps: Step[] = [
  {
    Icon: LayersIcon,
    title: 'Pick a tool',
    description: 'Choose what you want to do, like upscaling an image.',
  },
  {
    Icon: UploadIcon,
    title: 'Drop your image',
    description: 'Drag in a PNG, JPG or WebP, or click to browse your files.',
  },
  {
    Icon: DownloadIcon,
    title: 'Download the result',
    description: 'Compare the before and after, then save it.',
  },
]

export const homeFaqs: FaqItem[] = [
  {
    question: 'Is Piksel really free?',
    answer:
      'Yes. There are no accounts, credits, watermarks or daily limits. Everything runs on your own device, so there are no server costs to pass on to you.',
  },
  {
    question: 'Are my images uploaded anywhere?',
    answer:
      'No. Your images are processed entirely in your browser, on your own hardware. The only things Piksel downloads are the AI models themselves.',
  },
  {
    question: 'What do I need to run it?',
    answer:
      "Just a modern browser. Piksel uses WebGPU to run on your graphics card, which recent versions of Chrome and Edge support. If WebGPU isn't available, it falls back to your CPU. It works the same way, just more slowly.",
  },
  {
    question: 'My laptop has two graphics chips. Which one does Piksel use?',
    answer:
      'Your browser decides, and on Windows it often picks the built-in, slower one. To use your more powerful GPU, open Windows Settings, go to System > Display > Graphics, select your browser and set it to High performance, then restart the browser. Each tool shows which GPU is in use.',
  },
  {
    question: 'Can I use the results commercially?',
    answer:
      'Yes. Piksel adds no watermarks and claims no rights to your results. You just need the rights to the original image.',
  },
]
