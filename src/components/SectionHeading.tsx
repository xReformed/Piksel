type SectionHeadingProps = {
  id: string
  title: string
  description: string
}

export function SectionHeading({ id, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2
        id={id}
        className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-ink sm:text-5xl"
      >
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-slate-600">{description}</p>
    </div>
  )
}
