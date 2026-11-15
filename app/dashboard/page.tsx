"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  getBookmarks,
  loadDashboard,
  removeBookmark,
  saveBookmark,
  type ApiError,
} from "@/lib/client/api"
import {
  CATEGORY_LABELS,
  ELIGIBILITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  type Bookmark,
  type OpportunityView,
} from "@/lib/client/types"

const categoryOptions = Object.entries(CATEGORY_LABELS)
const inputStyle = "rounded-lg border p-3"
const buttonStyle = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50"

type ApplicationStatus = Bookmark["application_status"]
type BookmarkAction = "save" | "remove" | "saved" | "applying"

function compareDates(
  first: string | null | undefined,
  second: string | null | undefined,
  newestFirst = false,
) {
  const firstDate = Date.parse(first ?? "")
  const secondDate = Date.parse(second ?? "")

  if (Number.isNaN(firstDate)) return Number.isNaN(secondDate) ? 0 : 1
  if (Number.isNaN(secondDate)) return -1

  return newestFirst ? secondDate - firstDate : firstDate - secondDate
}

function OpportunityCard({
  opportunity,
  status,
  isUpdating,
  controlsDisabled,
  onBookmarkAction,
}: {
  opportunity: OpportunityView
  status: ApplicationStatus | undefined
  isUpdating: boolean
  controlsDisabled: boolean
  onBookmarkAction: (action: BookmarkAction) => void
}) {
  const match = opportunity.match
  const score = match?.relevance_score
  const isSaved = status !== undefined
  const requirements = opportunity.eligibility
    .map(({ raw_text }) => raw_text)
    .filter(Boolean)
    .join(" · ")

  const details = [
    ["Deadline", opportunity.deadline ?? opportunity.deadline_text ?? "Not announced"],
    ["Application requirements", requirements || "Not provided"],
    ["Opportunity verification", OPPORTUNITY_STATUS_LABELS[opportunity.status]],
    [
      "Application eligibility",
      match ? ELIGIBILITY_STATUS_LABELS[match.eligibility.status] : "Not available",
    ],
    ["Relevance score", score == null ? "Not available" : `${score} / 100`],
  ]

  return (
    <article className="space-y-4 rounded-xl border p-5">
      <header className="space-y-1">
        <p className="text-sm">
          {CATEGORY_LABELS[opportunity.category]} · {opportunity.organization}
        </p>
        <h2 className="text-lg font-semibold">{opportunity.title}</h2>
      </header>

      {opportunity.description && <p>{opportunity.description}</p>}

      <dl className="space-y-3 text-sm">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {match?.explanation && <p className="text-sm">{match.explanation}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {opportunity.source_url && (
          <a
            className="text-sm font-medium underline"
            href={opportunity.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View original source
          </a>
        )}

        <button
          type="button"
          className={buttonStyle}
          disabled={controlsDisabled}
          aria-label={`${isSaved ? "Remove saved opportunity" : "Save opportunity"}: ${opportunity.title}`}
          onClick={() => onBookmarkAction(isSaved ? "remove" : "save")}
        >
          {isUpdating ? "Updating…" : isSaved ? "Remove" : "Save"}
        </button>
      </div>

      {status !== undefined && (
        <label className="grid gap-1 text-sm">
          Application status
          <select
            className={inputStyle}
            value={status}
            disabled={controlsDisabled}
            onChange={(event) => {
              const nextStatus = event.target.value
              if (nextStatus === "saved" || nextStatus === "applying") {
                onBookmarkAction(nextStatus)
              }
            }}
          >
            {status !== "saved" && status !== "applying" && (
              <option value={status}>{status}</option>
            )}
            <option value="saved">Saved</option>
            <option value="applying">Applying</option>
          </select>
        </label>
      )}
    </article>
  )
}

function OpportunityList() {
  const searchParams = useSearchParams()
  const selectedCategories = searchParams
    .getAll("category")
    .filter((value) => categoryOptions.some(([category]) => category === value))

  const [items, setItems] = useState<OpportunityView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [matchError, setMatchError] = useState<ApiError | null>(null)
  const [dashboardRequest, setDashboardRequest] = useState(0)

  const [savedStatuses, setSavedStatuses] = useState(
    () => new Map<string, ApplicationStatus>(),
  )
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(true)
  const [bookmarkLoadError, setBookmarkLoadError] = useState("")
  const [bookmarkActionError, setBookmarkActionError] = useState("")
  const [bookmarkRequest, setBookmarkRequest] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState("default")
  const [savedOnly, setSavedOnly] = useState(false)

  useEffect(() => {
    let active = true

    loadDashboard({ q: "", sort: "relevance" })
      .then(({ items, matchError }) => {
        if (!active) return
        setItems(items)
        setMatchError(matchError)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(
          error instanceof Error && error.message
            ? error.message
            : "Could not load opportunities.",
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [dashboardRequest])

  useEffect(() => {
    let active = true

    getBookmarks()
      .then((bookmarks) => {
        if (!active) return

        setSavedStatuses(
          new Map(
            bookmarks.map(({ opportunity, application_status }) => [
              opportunity.opportunity_id,
              application_status,
            ] as const),
          ),
        )
      })
      .catch(() => {
        if (active) setBookmarkLoadError("Could not load your saved opportunities.")
      })
      .finally(() => {
        if (active) setIsLoadingBookmarks(false)
      })

    return () => {
      active = false
    }
  }, [bookmarkRequest])

  const bookmarksReady = !isLoadingBookmarks && !bookmarkLoadError

  async function changeBookmark(opportunityId: string, action: BookmarkAction) {
    if (!bookmarksReady || updatingId !== null) return

    const currentStatus = savedStatuses.get(opportunityId)
    if (action === "save" ? currentStatus !== undefined : currentStatus === undefined) {
      return
    }
    if (action === currentStatus) return

    setUpdatingId(opportunityId)
    setBookmarkActionError("")

    try {
      if (action === "remove") {
        await removeBookmark(opportunityId)
        setSavedStatuses((current) => {
          const updated = new Map(current)
          updated.delete(opportunityId)
          return updated
        })
      } else {
        const bookmark = await saveBookmark(
          opportunityId,
          action === "save" ? "saved" : action,
        )
        setSavedStatuses((current) =>
          new Map(current).set(opportunityId, bookmark.application_status),
        )
      }
    } catch {
      const messages = {
        save: "Could not save this opportunity. Please try again.",
        remove: "Could not remove this saved opportunity. Please try again.",
        saved: "Could not update the application status. Please try again.",
        applying: "Could not update the application status. Please try again.",
      }
      setBookmarkActionError(messages[action])
    } finally {
      setUpdatingId(null)
    }
  }

  const preferredFilter = selectedCategories.length > 0 ? "interests" : "all"
  const activeCategory =
    categoryFilter === "interests" ? preferredFilter : categoryFilter ?? preferredFilter
  const keyword = query.trim().toLowerCase()

  const visibleOpportunities = items.filter((opportunity) => {
    const matchesCategory =
      activeCategory === "all" ||
      (activeCategory === "interests"
        ? selectedCategories.includes(opportunity.category)
        : opportunity.category === activeCategory)

    const searchableText = [
      opportunity.title,
      opportunity.organization,
      opportunity.description,
    ].join(" ").toLowerCase()

    return (
      matchesCategory &&
      searchableText.includes(keyword) &&
      (!savedOnly || savedStatuses.has(opportunity.opportunity_id))
    )
  })

  switch (sortBy) {
    case "deadline":
      visibleOpportunities.sort((first, second) =>
        compareDates(first.deadline, second.deadline),
      )
      break
    case "collected":
      visibleOpportunities.sort((first, second) =>
        compareDates(first.first_collected_at, second.first_collected_at, true),
      )
      break
    case "match":
      visibleOpportunities.sort(
        (first, second) =>
          (second.match?.relevance_score ?? -1) - (first.match?.relevance_score ?? -1),
      )
      break
  }

  if (isLoading) return <p role="status">Loading opportunities…</p>

  if (loadError) {
    return (
      <div className="space-y-3">
        <p role="alert">{loadError}</p>
        <button
          type="button"
          className={buttonStyle}
          onClick={() => {
            setLoadError("")
            setIsLoading(true)
            setDashboardRequest((current) => current + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {matchError && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {matchError.code === "PROFILE_NOT_FOUND" ? (
            <>
              <Link className="underline" href="/onboarding">
                Set up your profile
              </Link>
              {" "}to see personalized matches.
            </>
          ) : (
            "Personalized ranking is unavailable right now. You can still browse opportunities."
          )}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search opportunities"
          placeholder="Search opportunities"
          className={inputStyle}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          aria-label="Opportunity category"
          className={inputStyle}
          value={activeCategory}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          {selectedCategories.length > 0 && (
            <option value="interests">My selected categories</option>
          )}
          <option value="all">All categories</option>
          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          aria-label="Sort opportunities"
          className={inputStyle}
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="default">Default order</option>
          <option value="deadline">Earliest deadline</option>
          <option value="collected">Recently collected</option>
          <option value="match">Best match</option>
        </select>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={savedOnly}
          disabled={!bookmarksReady}
          onChange={(event) => setSavedOnly(event.target.checked)}
        />
        Saved only
      </label>

      {isLoadingBookmarks && <p role="status">Loading saved opportunities…</p>}

      {bookmarkLoadError && (
        <div className="space-y-2">
          <p role="alert">{bookmarkLoadError}</p>
          <button
            type="button"
            className={buttonStyle}
            onClick={() => {
              setBookmarkLoadError("")
              setIsLoadingBookmarks(true)
              setBookmarkRequest((current) => current + 1)
            }}
          >
            Retry loading saved opportunities
          </button>
        </div>
      )}

      {bookmarkActionError && <p role="alert">{bookmarkActionError}</p>}

      {visibleOpportunities.length === 0 ? (
        <p role="status">
          {savedOnly
            ? "No saved opportunities match your filters."
            : items.length === 0
              ? "No opportunities are available yet."
              : "No opportunities match your filters."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleOpportunities.map((opportunity) => {
            const id = opportunity.opportunity_id

            return (
              <OpportunityCard
                key={id}
                opportunity={opportunity}
                status={savedStatuses.get(id)}
                isUpdating={updatingId === id}
                controlsDisabled={!bookmarksReady || updatingId !== null}
                onBookmarkAction={(action) => void changeBookmark(id, action)}
              />
            )
          })}
        </div>
      )}
    </>
  )
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Academic Opportunities</h1>

        <Link href="/onboarding" className={buttonStyle}>
          Edit profile
        </Link>
      </div>

      <Suspense fallback={<p>Loading opportunities…</p>}>
        <OpportunityList />
      </Suspense>
    </main>
  )
}