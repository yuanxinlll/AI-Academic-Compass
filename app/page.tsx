import Link from "next/link"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-start justify-center gap-5 px-6 py-12">
      <h1 className="text-4xl font-bold sm:text-6xl">Academic Compass</h1>
      <p className="max-w-xl text-lg">
        Find UC San Diego research positions, internships, and academic events
        in one place.
      </p>
      <Link href="/onboarding" className="rounded-lg bg-blue-700 px-5 py-3 text-white">
        Get started
      </Link>
    </main>
  )
}