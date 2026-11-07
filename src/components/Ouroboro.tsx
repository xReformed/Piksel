// Piksel's loading spinner: a ring that fills from two sides, then empties again, like a snake
// eating its tail. Adapted from the Ouroboro spinner in react-spinners-css (MIT,
// github.com/JoshK2/react-spinners-css).
//
// It's drawn in the text color (brand purple by default; white inside a purple button), with a
// faint track behind it and a see-through middle, so it works on any background. Pass a size and,
// if needed, a text color: <Ouroboro className="size-4" />.
//
// Each half of the ring holds a half-disc that starts hidden outside it. Both turn around the
// center together: halfway through they cover the whole ring, and by the end they've turned back
// out. The mask cuts the hole.
export function Ouroboro({ className = 'size-5 text-brand-600' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-current/20 [mask-image:radial-gradient(closest-side,transparent_67%,#000_70%)] ${className}`}
    >
      <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        <span className="absolute top-0 left-full size-full origin-left animate-ouroboro rounded-r-full bg-current" />
      </span>
      <span className="absolute inset-y-0 left-1/2 w-1/2 overflow-hidden">
        <span className="absolute top-0 -left-full size-full origin-right animate-ouroboro rounded-l-full bg-current" />
      </span>
    </span>
  )
}
