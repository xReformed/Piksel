import { PlusIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

const faqs = [
  {
    question: 'Is Piksel really free?',
    answer:
      'Yes. There are no credits, no watermarks and no daily limits. Upscaling happens on your own device, so there are no server costs to pass on to you.',
  },
  {
    question: 'Are my images uploaded anywhere?',
    answer:
      'No. Your images are processed entirely in your browser, on your own hardware. The only thing Piksel downloads is the AI model itself.',
  },
  {
    question: 'Why does the first upscale take longer?',
    answer:
      "The first time, your browser downloads the AI model. It's saved for next time, so later upscales start right away.",
  },
  {
    question: 'What do I need to run it?',
    answer:
      "Just a modern browser. Piksel uses WebGPU to run on your graphics card, which recent versions of Chrome and Edge support. If WebGPU isn't available, it falls back to your CPU. It works the same way, just more slowly.",
  },
  {
    question: 'My laptop has two graphics chips. Which one does Piksel use?',
    answer:
      'Your browser decides, and on Windows it often picks the built-in, slower one. To use your more powerful GPU, open Windows Settings, go to System > Display > Graphics, select your browser and set it to High performance, then restart the browser. The upscaler page shows which GPU is in use.',
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
  {
    question: 'Can I use the upscaled images commercially?',
    answer:
      'Yes. Piksel adds no watermarks and claims no rights to your results. You just need the rights to the original image.',
  },
]

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mt-24 scroll-mt-8 sm:mt-32">
      <SectionHeading
        id="faq-heading"
        title="Frequently asked questions"
        description="Quick answers about privacy, hardware and file formats."
      />

      <div className="mx-auto mt-12 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
        {faqs.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              {question}
              <PlusIcon className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-45" />
            </summary>
            <p className="-mt-1 pr-11 pb-5 text-pretty text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
