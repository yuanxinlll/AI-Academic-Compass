"use client"

import { useState } from "react"

const sampleResume = {
  university: "UC San Diego",
  major: "Cognitive Science",
  academicInterests: "Neuroscience, machine learning",
  languages: "Python",
  skills: "Data visualization, Figma",
  researchExperience: "Helped organize data for a classroom study.",
  internshipExperience: "",
  projectExperience: "Built a dashboard to visualize a sample survey.",
}

const resumeFields = [
  { key: "university", label: "University" },
  { key: "major", label: "Major" },
  { key: "academicInterests", label: "Academic interests" },
  { key: "languages", label: "Programming languages" },
  { key: "skills", label: "Technical skills" },
  { key: "researchExperience", label: "Research experience" },
  { key: "internshipExperience", label: "Internship experience" },
  { key: "projectExperience", label: "Project experience" },
] as const

const categories = [
  { value: "research", label: "Research", available: true },
  { value: "internship", label: "Internships", available: true },
  { value: "event", label: "Academic events", available: true },
  { value: "competition", label: "Competitions", available: true },
  { value: "program", label: "Academic programs", available: true },
  { value: "course", label: "Courses and learning", available: true },
]

type ResumeDetails = typeof sampleResume

const emptyDetails: ResumeDetails = {
  university: "",
  major: "",
  academicInterests: "",
  languages: "",
  skills: "",
  researchExperience: "",
  internshipExperience: "",
  projectExperience: "",
}

const inputStyle = "w-full rounded-lg border px-3 py-2"
const sectionStyle = "space-y-4 rounded-xl border p-5"
const primaryButton = "rounded-lg bg-blue-700 px-5 py-3 text-white"
const secondaryButton = "rounded-lg border px-4 py-2"

function TextField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="grid gap-2">
      {label}
      <input placeholder={placeholder} className={inputStyle} />
    </label>
  )
}

export default function OnboardingPage() {
  const [details, setDetails] = useState(emptyDetails)
  const [preview, setPreview] = useState<ResumeDetails | null>(null)
  const [status, setStatus] = useState("")

  function applyResumeDetails() {
    if (!preview) return

    const confirmedDetails = preview
    setDetails((current) => {
      const updated = { ...current }

      for (const { key } of resumeFields) {
        const value = confirmedDetails[key].trim()
        if (value) updated[key] = value
      }

      return updated
    })

    setPreview(null)
    setStatus("Sample résumé details added to your form.")
  }

  function renderProfileField(field: (typeof resumeFields)[number]) {
    return (
      <label key={field.key} className="grid gap-2">
        {field.label}
        <input
          className={inputStyle}
          value={details[field.key]}
          onChange={(event) => {
            const value = event.target.value
            setDetails((current) => ({ ...current, [field.key]: value }))
          }}
        />
      </label>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Set up your profile</h1>
      <p className="mb-6 mt-2 text-sm">
        Your selected opportunity categories filter the Dashboard.
      </p>

      <form action="/dashboard" method="get" className="space-y-6">
        <section aria-labelledby="resume-heading" className={sectionStyle}>
          <h2 id="resume-heading" className="text-xl font-semibold">
            Résumé (optional)
          </h2>

          <label className="grid gap-2">
            Choose a PDF
            <input type="file" accept=".pdf,application/pdf" className="max-w-full" />
          </label>
          <p className="text-sm">
            PDF parsing will be available when the service is connected.
          </p>

          {preview === null ? (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setPreview({ ...sampleResume })
                setStatus("")
              }}
            >
              Try sample résumé
            </button>
          ) : (
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Review sample results</h3>
              <p className="text-sm">
                Edit the sample details before applying them. Each non-empty
                value replaces the corresponding answer below.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {resumeFields.map(({ key, label }) => (
                  <label key={key} className="grid gap-2">
                    {label}
                    <textarea
                      rows={2}
                      className={inputStyle}
                      value={preview[key]}
                      onChange={(event) => {
                        const value = event.target.value
                        setPreview((current) =>
                          current ? { ...current, [key]: value } : null
                        )
                      }}
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className={primaryButton} onClick={applyResumeDetails}>
                  Use these details
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p role="status" className="text-sm">{status}</p>
        </section>

        <section className={sectionStyle}>
          <h2 className="text-xl font-semibold">Academic background</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {resumeFields.slice(0, 2).map(renderProfileField)}
            <TextField label="Minor (optional)" placeholder="Data Science" />
            <TextField label="Current year" placeholder="First year" />
            <TextField label="Expected graduation" placeholder="Spring 2030" />
            <TextField label="Completed courses" placeholder="Intro to Python, Statistics" />
          </div>
        </section>

        <section className={sectionStyle}>
          <h2 className="text-xl font-semibold">Interests and goals</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {resumeFields.slice(2, 3).map(renderProfileField)}
            <TextField label="Research interests" placeholder="Brain–computer interfaces" />
            <TextField label="Career goals" placeholder="AI engineering" />
            <TextField label="Preferred activities" placeholder="Workshops, seminars" />
          </div>

          <fieldset>
            <legend className="mb-2 font-medium">Opportunity categories</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map(({ value, label, available }) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="checkbox" name="category" value={value} disabled={!available} />
                  <span>{label}{!available && " (Coming soon)"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className={sectionStyle}>
          <h2 className="text-xl font-semibold">Skills and experience</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {resumeFields.slice(3).map(renderProfileField)}
            <label className="grid gap-2">
              Other experience
              <textarea
                rows={2}
                placeholder="Clubs, volunteering, or other roles"
                className={inputStyle}
              />
            </label>
          </div>
        </section>

        <section className={sectionStyle}>
          <h2 className="text-xl font-semibold">Eligibility and availability</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              Hours available per week
              <input type="number" min={0} max={168} placeholder="10" className={inputStyle} />
            </label>
            <TextField label="Available project period" placeholder="Winter and spring quarters" />
          </div>
          <p className="text-sm">
            Enter your current year and completed courses under Academic background.
          </p>
        </section>

        <button type="submit" className={primaryButton}>
          Continue
        </button>
      </form>
    </main>
  )
}