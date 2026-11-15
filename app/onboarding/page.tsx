"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { RequireSignIn } from "@/app/components/session"
import {
  ApiError,
  getProfile,
  joinList,
  mergeResumeDraft,
  parseResume,
  saveProfile,
  splitList,
} from "@/lib/client/api"
import {
  ACADEMIC_YEARS,
  ACADEMIC_YEAR_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  type StudentProfileInput,
} from "@/lib/client/types"

type ListField =
  | "courses_taken"
  | "interests"
  | "research_areas"
  | "career_goals"
  | "skills"
  | "available_terms"

type ProfileForm = Omit<StudentProfileInput, ListField | "hours_per_week"> &
  Record<ListField | "hours_per_week", string>

type Experience = StudentProfileInput["experiences"][number]
type ResumeReview = ReturnType<typeof mergeResumeDraft>

const emptyForm: ProfileForm = {
  university: "",
  major: null,
  minor: null,
  academic_year: null,
  expected_graduation: null,
  courses_taken: "",
  interests: "",
  research_areas: "",
  career_goals: "",
  selected_modules: [],
  skills: "",
  experiences: [],
  hours_per_week: "",
  available_terms: "",
  work_authorization: null,
}

const resumeFields = [
  ["university", "University"],
  ["major", "Major"],
  ["minor", "Minor"],
  ["academic_year", "Current year"],
  ["expected_graduation", "Expected graduation"],
  ["courses_taken", "Completed courses"],
  ["interests", "Academic interests"],
  ["research_areas", "Research interests"],
  ["career_goals", "Career goals"],
  ["skills", "Skills"],
  ["experiences", "Experience"],
] as const

const sampleResume: Partial<StudentProfileInput> = {
  university: "UC San Diego",
  major: "Cognitive Science",
  research_areas: ["Neuroscience", "Machine learning"],
  skills: ["Python", "Data visualization", "Figma"],
}

const inputStyle = "w-full rounded-lg border px-3 py-2"
const sectionStyle = "space-y-4 rounded-xl border p-5"
const primaryButton = "rounded-lg bg-blue-700 px-5 py-3 text-white disabled:opacity-60"
const secondaryButton = "rounded-lg border px-4 py-2 disabled:opacity-60"

function toForm(profile: StudentProfileInput): ProfileForm {
  return {
    university: profile.university,
    major: profile.major,
    minor: profile.minor,
    academic_year: profile.academic_year,
    expected_graduation: profile.expected_graduation,
    courses_taken: joinList(profile.courses_taken),
    interests: joinList(profile.interests),
    research_areas: joinList(profile.research_areas),
    career_goals: joinList(profile.career_goals),
    selected_modules: profile.selected_modules,
    skills: joinList(profile.skills),
    experiences: profile.experiences,
    hours_per_week: profile.hours_per_week?.toString() ?? "",
    available_terms: joinList(profile.available_terms),
    work_authorization: profile.work_authorization,
  }
}

function toProfile(form: ProfileForm): StudentProfileInput {
  return {
    ...form,
    university: form.university.trim(),
    major: form.major?.trim() || null,
    minor: form.minor?.trim() || null,
    expected_graduation: form.expected_graduation || null,
    courses_taken: splitList(form.courses_taken),
    interests: splitList(form.interests),
    research_areas: splitList(form.research_areas),
    career_goals: splitList(form.career_goals),
    skills: splitList(form.skills),
    available_terms: splitList(form.available_terms),
    hours_per_week: form.hours_per_week === "" ? null : Number(form.hours_per_week),
    work_authorization: form.work_authorization?.trim() || null,
  }
}

function describeValue(value: unknown): string {
  if (value == null || value === "") return "Empty"
  if (Array.isArray(value)) {
    return value.length ? value.map(describeValue).join("\n") : "Empty"
  }

  if (typeof value === "object" && "title" in value) {
    const experience = value as Experience
    return [experience.title, experience.organization, experience.description]
      .filter(Boolean)
      .join(" · ")
  }

  return String(value)
}

function OnboardingForm() {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [errorField, setErrorField] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [resumeError, setResumeError] = useState("")
  const [resumeStatus, setResumeStatus] = useState("")
  const [review, setReview] = useState<ResumeReview | null>(null)
  const [choices, setChoices] = useState<Record<string, "current" | "draft">>({})

  useEffect(() => {
    let active = true

    getProfile()
      .then((profile) => {
        if (active && profile) setForm(toForm(profile))
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Could not load your profile.")
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openReview(draft: Partial<StudentProfileInput>) {
    // Review only résumé fields. Eligibility and preferences come from the form.
    const entries = resumeFields.flatMap(([key]) => {
      const value = draft[key]
      if (value == null || value === "" || (Array.isArray(value) && !value.length)) {
        return []
      }
      return [[key, value] as const]
    })

    if (!entries.length) {
      setResumeStatus("No profile details were found. You can fill in the form manually.")
      return
    }

    setChoices({})
    setReview(mergeResumeDraft(toProfile(form), Object.fromEntries(entries)))
  }

  async function handleParse() {
    if (!file || isParsing || isSaving || review) return

    setResumeError("")
    setResumeStatus("")
    setIsParsing(true)

    try {
      const draft = await parseResume(file, consent)
      openReview(draft)
    } catch (error: unknown) {
      setResumeError(error instanceof Error ? error.message : "Could not parse the résumé.")
    } finally {
      setIsParsing(false)
    }
  }

  const allConflictsReviewed =
    review?.conflicts.every(({ field }) => choices[field] !== undefined) ?? false

  function applyReview() {
    if (!review || !allConflictsReviewed) return

    const chosenValues = Object.fromEntries(
      review.conflicts
        .filter(({ field }) => choices[field] === "draft")
        .map(({ field, draft }) => [field, draft]),
    )

    setForm(toForm({ ...toProfile(form), ...review.merged, ...chosenValues }))
    setReview(null)
    setResumeStatus("Details added to your form. You can edit them before saving.")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || isParsing || review || isLoading || loadError) return

    setSaveError("")
    setErrorField(null)
    const profile = toProfile(form)

    if (!profile.university) {
      setErrorField("university")
      setSaveError("Enter your university.")
      return
    }

    setIsSaving(true)

    try {
      await saveProfile(profile)
      router.push("/")
    } catch (error: unknown) {
      setErrorField(error instanceof ApiError ? error.field ?? null : null)
      setSaveError(error instanceof Error ? error.message : "Could not save your profile.")
      setIsSaving(false)
    }
  }

  function renderField(
    key: ListField | "university" | "major" | "minor" |
      "expected_graduation" | "hours_per_week" | "work_authorization",
    label: string,
    placeholder?: string,
  ) {
    const type = key === "expected_graduation" ? "month" :
      key === "hours_per_week" ? "number" : "text"

    return (
      <label className="grid gap-2">
        {label}
        <input
          name={key}
          type={type}
          className={inputStyle}
          placeholder={placeholder}
          value={form[key] ?? ""}
          required={key === "university"}
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 168 : undefined}
          step={type === "number" ? 1 : undefined}
          aria-invalid={errorField === key}
          onChange={(event) => updateField(key, event.target.value)}
        />
      </label>
    )
  }

  function updateExperience(
    index: number,
    key: "title" | "organization" | "description",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      experiences: current.experiences.map((experience, itemIndex) =>
        itemIndex === index
          ? { ...experience, [key]: key === "title" ? value : value || null }
          : experience,
      ),
    }))
  }

  const formLocked = isSaving || isParsing || review !== null

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Set up your profile</h1>

      {isLoading ? (
        <p role="status">Loading your profile…</p>
      ) : loadError ? (
        <div className="space-y-3">
          <p role="alert">Could not open your profile. {loadError}</p>
          <button type="button" className={secondaryButton} onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={isSaving} className={sectionStyle}>
            <legend className="px-1 text-xl font-semibold">Résumé (optional)</legend>

            <label className="grid gap-2">
              Choose a PDF (up to 4 MB)
              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={isParsing || review !== null}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setConsent(false)
                  setResumeError("")
                  setResumeStatus("")
                }}
              />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                disabled={isParsing || review !== null}
                onChange={(event) => setConsent(event.target.checked)}
              />
              I agree to send my résumé text to Gemini for AI-assisted extraction.
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryButton}
                disabled={!file || isParsing || review !== null}
                onClick={handleParse}
              >
                {isParsing ? "Parsing…" : "Parse résumé"}
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={isParsing || review !== null}
                onClick={() => {
                  setResumeError("")
                  setResumeStatus("")
                  openReview(sampleResume)
                }}
              >
                Try sample résumé
              </button>
            </div>

            {resumeError && <p role="alert">{resumeError}</p>}
            {resumeStatus && <p role="status">{resumeStatus}</p>}

            {review && (
              <div className="space-y-4 rounded-lg border p-4">
                <h2 className="font-semibold">Review résumé details</h2>
                <p className="text-sm">Choose which value to keep where the details differ.</p>

                {resumeFields.map(([key, label]) => {
                  const conflict = review.conflicts.find(({ field }) => field === key)
                  const value = review.merged[key]

                  if (conflict) {
                    return (
                      <fieldset key={key} className="space-y-2 rounded-lg border p-3">
                        <legend className="px-1 font-medium">{label}</legend>
                        <label className="flex items-start gap-2">
                          <input
                            type="radio"
                            name={`resume-${key}`}
                            checked={choices[key] === "current"}
                            onChange={() => setChoices((current) => ({ ...current, [key]: "current" }))}
                          />
                          <span className="whitespace-pre-line">
                            Keep current · {describeValue(conflict.current)}
                          </span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input
                            type="radio"
                            name={`resume-${key}`}
                            checked={choices[key] === "draft"}
                            onChange={() => setChoices((current) => ({ ...current, [key]: "draft" }))}
                          />
                          <span className="whitespace-pre-line">
                            Use résumé · {describeValue(conflict.draft)}
                          </span>
                        </label>
                      </fieldset>
                    )
                  }

                  const originalValue = toProfile(form)[key]
                  if (JSON.stringify(value) === JSON.stringify(originalValue)) return null

                  return (
                    <div key={key}>
                      <p className="font-medium">{label}</p>
                      <p className="whitespace-pre-line text-sm">{describeValue(value)}</p>
                    </div>
                  )
                })}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={!allConflictsReviewed}
                    onClick={applyReview}
                  >
                    Use these details
                  </button>
                  <button type="button" className={secondaryButton} onClick={() => setReview(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset disabled={formLocked} className="space-y-6">
            <section className={sectionStyle}>
              <h2 className="text-xl font-semibold">Academic background</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {renderField("university", "University", "UC San Diego")}
                {renderField("major", "Major", "Cognitive Science")}
                {renderField("minor", "Minor (optional)")}
                <label className="grid gap-2">
                  Current year
                  <select
                    className={inputStyle}
                    value={form.academic_year ?? ""}
                    aria-invalid={errorField === "academic_year"}
                    onChange={(event) =>
                      updateField(
                        "academic_year",
                        ACADEMIC_YEARS.find((year) => year === event.target.value) ?? null,
                      )
                    }
                  >
                    <option value="">Select your year</option>
                    {ACADEMIC_YEARS.map((year) => (
                      <option key={year} value={year}>{ACADEMIC_YEAR_LABELS[year]}</option>
                    ))}
                  </select>
                </label>
                {renderField("expected_graduation", "Expected graduation")}
                {renderField("courses_taken", "Completed courses", "Statistics, Intro to Python")}
              </div>
            </section>

            <section className={sectionStyle}>
              <h2 className="text-xl font-semibold">Interests and goals</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {renderField("interests", "Academic interests", "AI, neuroscience")}
                {renderField("research_areas", "Research interests", "Brain–computer interfaces")}
                {renderField("career_goals", "Career goals", "AI engineering")}
              </div>

              <fieldset>
                <legend className="mb-2 font-medium">Opportunity categories</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.selected_modules.includes(category)}
                        onChange={(event) =>
                          updateField(
                            "selected_modules",
                            event.target.checked
                              ? [...form.selected_modules, category]
                              : form.selected_modules.filter((item) => item !== category),
                          )
                        }
                      />
                      {CATEGORY_LABELS[category]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className={sectionStyle}>
              <h2 className="text-xl font-semibold">Skills and experience</h2>
              {renderField("skills", "Skills (comma-separated)", "Python, SQL, data visualization")}

              {form.experiences.map((experience, index) => (
                <fieldset key={index} className="space-y-3 rounded-lg border p-4">
                  <legend className="px-1 font-medium">
                    Experience {index + 1} · {experience.type}
                  </legend>
                  <label className="grid gap-2">
                    Title
                    <input
                      required
                      className={inputStyle}
                      value={experience.title}
                      onChange={(event) => updateExperience(index, "title", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    Organization
                    <input
                      className={inputStyle}
                      value={experience.organization ?? ""}
                      onChange={(event) => updateExperience(index, "organization", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    Description
                    <textarea
                      className={inputStyle}
                      value={experience.description ?? ""}
                      onChange={(event) => updateExperience(index, "description", event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() =>
                      updateField("experiences", form.experiences.filter((_, item) => item !== index))
                    }
                  >
                    Remove experience
                  </button>
                </fieldset>
              ))}
            </section>

            <section className={sectionStyle}>
              <h2 className="text-xl font-semibold">Eligibility and availability</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {renderField("hours_per_week", "Hours available per week", "10")}
                {renderField("available_terms", "Available terms", "Winter, Spring")}
                {renderField("work_authorization", "Work authorization (optional)")}
              </div>
            </section>

            {saveError && (
              <p role="alert" className="rounded-lg border border-red-400 p-3">
                {errorField && <span className="font-medium">{errorField} · </span>}
                {saveError}
              </p>
            )}

            <button type="submit" className={primaryButton}>
              {isSaving ? "Saving…" : "Continue"}
            </button>
          </fieldset>
        </form>
      )}
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <RequireSignIn>
      <div className="legacy">
        <OnboardingForm />
      </div>
    </RequireSignIn>
  )
}
