"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

const categories = {
  research: "Research",
  internship: "Internship",
  event: "Academic event",
  competition: "Competition",
  program: "Academic program",
  course: "Courses and learning",
} as const

const verificationLabels = {
  verified: "Verified",
  needs_verification: "Needs verification",
} as const

const eligibilityLabels = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  needs_verification: "Needs confirmation",
} as const

type Opportunity = {
  opportunity_id: string
  title: string
  university: string
  category: keyof typeof categories
  description: string
  deadline: string | null
  published_at: string | null
  match_score: number | null
  eligibility: string[]
  required_skills: string[]
  application_method: string | null
  source_url: string | null
  status: keyof typeof verificationLabels
  eligibility_status: keyof typeof eligibilityLabels
}

const opportunities: Opportunity[] = [
  {
    opportunity_id: "demo-research",
    title: "Cognitive Science Lab Assistant",
    university: "UC San Diego",
    category: "research",
    description: "Help organize study materials and prepare research sessions.",
    deadline: null,
    published_at: "2026-11-05",
    match_score: 96,
    eligibility: ["Current undergraduate", "Available 5 hours per week"],
    required_skills: ["Python"],
    application_method: "Email a résumé and a short statement of interest.",
    source_url: null,
    status: "needs_verification",
    eligibility_status: "eligible",
  },
  {
    opportunity_id: "demo-internship",
    title: "Campus Data Intern",
    university: "UC San Diego",
    category: "internship",
    description: "Help a campus team explore and visualize student survey data.",
    deadline: "2027-01-15",
    published_at: "2026-11-08",
    match_score: 88,
    eligibility: ["Second year or above"],
    required_skills: ["Spreadsheet analysis"],
    application_method: "Submit a résumé through the application portal.",
    source_url: null,
    status: "verified",
    eligibility_status: "ineligible",
  },
  {
    opportunity_id: "demo-event",
    title: "Getting Started in Undergraduate Research",
    university: "UC San Diego",
    category: "event",
    description: "Learn how to find labs and reach out to faculty.",
    deadline: null,
    published_at: "2026-11-13",
    match_score: 76,
    eligibility: [],
    required_skills: [],
    application_method: null,
    source_url: null,
    status: "needs_verification",
    eligibility_status: "needs_verification",
  },
  {
    opportunity_id: "demo-competition",
    title: "Campus Data Challenge",
    university: "UC San Diego",
    category: "competition",
    description: "Work in a team to explore a campus dataset and present your findings.",
    deadline: "2027-02-05",
    published_at: "2026-11-11",
    match_score: 82,
    eligibility: ["Current undergraduate"],
    required_skills: ["Basic data analysis"],
    application_method: "Register as an individual or a team.",
    source_url: null,
    status: "needs_verification",
    eligibility_status: "needs_verification",
  },
  {
    opportunity_id: "demo-program",
    title: "Summer Research Exploration Program",
    university: "UC San Diego",
    category: "program",
    description: "Explore undergraduate research through workshops and faculty mentorship.",
    deadline: "2027-03-01",
    published_at: "2026-11-03",
    match_score: 91,
    eligibility: ["Current undergraduate"],
    required_skills: [],
    application_method: "Submit a short statement of interest.",
    source_url: null,
    status: "needs_verification",
    eligibility_status: "needs_verification",
  },
  {
    opportunity_id: "demo-course",
    title: "Introduction to Research Data Visualization",
    university: "UC San Diego",
    category: "course",
    description: "Practice choosing charts and communicating findings from a sample dataset.",
    deadline: null,
    published_at: "2026-11-09",
    match_score: 70,
    eligibility: [],
    required_skills: [],
    application_method: null,
    source_url: null,
    status: "needs_verification",
    eligibility_status: "needs_verification",
  },
]

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const details = [
    ["Deadline", opportunity.deadline ?? "Not announced"],
    ["Sample publication date", opportunity.published_at ?? "Not provided"],
    [
      "Sample match score",
      opportunity.match_score === null
        ? "Not available"
        : `${opportunity.match_score} / 100`,
    ],
    ["Application requirements", opportunity.eligibility.join(" · ") || "Not provided"],
    ["Required skills", opportunity.required_skills.join(", ") || "Not provided"],
    ["How to apply", opportunity.application_method ?? "Not provided"],
    ["Opportunity verification", verificationLabels[opportunity.status]],
    ["Application eligibility", eligibilityLabels[opportunity.eligibility_status]],
  ]

  return (
    <article className="space-y-4 rounded-xl border p-5">
      <header className="space-y-1">
        <p className="text-sm">
          {categories[opportunity.category]} · {opportunity.university}
        </p>
        <h2 className="text-lg font-semibold">{opportunity.title}</h2>
      </header>

      <p>{opportunity.description}</p>

      <dl className="space-y-3 text-sm">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {opportunity.source_url ? (
        <a className="text-sm font-medium underline" href={opportunity.source_url}>
          View original source
        </a>
      ) : (
        <p className="text-sm">Original source unavailable for this sample.</p>
      )}
    </article>
  )
}

function compareDates(
  first: string | null,
  second: string | null,
  order: "ascending" | "descending",
) {
  if (first === null) return second === null ? 0 : 1
  if (second === null) return -1

  const difference = Date.parse(first) - Date.parse(second)
  return order === "ascending" ? difference : -difference
}

function OpportunityList() {
  const searchParams = useSearchParams()
  const selectedCategories = searchParams
    .getAll("category")
    .filter((value) => Object.hasOwn(categories, value))

  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState("default")

  const activeCategory =
    categoryFilter ?? (selectedCategories.length > 0 ? "interests" : "all")
  const allowedCategories =
    activeCategory === "interests" ? selectedCategories : [activeCategory]
  const keyword = query.trim().toLowerCase()

  const visibleOpportunities = opportunities.filter((opportunity) => {
    const matchesCategory =
      activeCategory === "all" || allowedCategories.includes(opportunity.category)
    const searchableText =
      `${opportunity.title} ${opportunity.description}`.toLowerCase()

    return matchesCategory && searchableText.includes(keyword)
  })

  switch (sortBy) {
    case "deadline":
      visibleOpportunities.sort((first, second) =>
        compareDates(first.deadline, second.deadline, "ascending"),
      )
      break
    case "published":
      visibleOpportunities.sort((first, second) =>
        compareDates(first.published_at, second.published_at, "descending"),
      )
      break
    case "match":
      visibleOpportunities.sort(
        (first, second) => (second.match_score ?? -1) - (first.match_score ?? -1),
      )
      break
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search opportunities"
          placeholder="Search opportunities"
          className="rounded-lg border p-3"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          aria-label="Category"
          className="rounded-lg border p-3"
          value={activeCategory}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          {selectedCategories.length > 0 && (
            <option value="interests">My selected categories</option>
          )}
          <option value="all">All categories</option>
          {Object.entries(categories).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          aria-label="Sort opportunities"
          className="rounded-lg border p-3"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="default">Default order</option>
          <option value="deadline">Earliest deadline</option>
          <option value="published">Newest published</option>
          <option value="match">Best match</option>
        </select>
      </div>

      {visibleOpportunities.length === 0 && (
        <p>No opportunities match your search.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.opportunity_id}
            opportunity={opportunity}
          />
        ))}
      </div>
    </>
  )
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Academic Opportunities</h1>
      <p>Demo opportunities with sample dates, match scores, and eligibility results.</p>

      <Suspense fallback={<p>Loading opportunities…</p>}>
        <OpportunityList />
      </Suspense>
    </main>
  )
}