type SectionHeadingProps = {
  id: string
  title: string
  description: string
}

export function SectionHeading({ id, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2
        id={id}
        className="text-3xl font-bold tracking-[-0.03em] text-balance text-slate-950 sm:text-4xl"
      >
        {title}
      </h2>
      <p className="mt-4 text-lg text-pretty text-slate-500">{description}</p>
    </div>
  )
}
