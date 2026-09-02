const companyName = new URLSearchParams(window.location.search).get('name')

const nameEl = document.getElementById('company-name')
const statusEl = document.getElementById('status')

const alumniStatusEl = document.getElementById('alumni-status')
const alumniLayoutEl = document.getElementById('alumni-layout')
const alumniCardsEl = document.getElementById('alumni-cards')
const analyticsFunctionEl = document.getElementById('analytics-function')
const analyticsLocationEl = document.getElementById('analytics-location')

const jobsStatusEl = document.getElementById('jobs-status')
const jobsWarningEl = document.getElementById('jobs-warning')
const jobsListEl = document.getElementById('jobs-list')

function renderAlumnus(alum) {
  const card = document.createElement('div')
  card.className = 'alumni-card'

  const name = document.createElement('div')
  name.className = 'alumni-name'
  name.textContent = `${alum.first_name} ${alum.last_name}`
  card.append(name)

  const grad = document.createElement('div')
  grad.className = 'alumni-meta'
  grad.textContent = `Class of ${alum.graduating_year}`
  card.append(grad)

  if (alum.ft_title) {
    const title = document.createElement('div')
    title.className = 'alumni-meta'
    title.textContent = `Title: ${alum.ft_title}`
    card.append(title)
  }

  if (alum.ft_function) {
    const fn = document.createElement('div')
    fn.className = 'alumni-meta'
    fn.textContent = `Function: ${alum.ft_function}`
    card.append(fn)
  }

  const email = document.createElement('a')
  email.className = 'alumni-email'
  email.href = `mailto:${alum.email}`
  email.textContent = alum.email
  card.append(email)

  return card
}

function breakdownBy(alumni, key) {
  const counts = new Map()
  for (const alum of alumni) {
    const label = alum[key] || 'Unknown'
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function renderBreakdown(listEl, breakdown) {
  listEl.replaceChildren(
    ...breakdown.map(({ label, count }) => {
      const li = document.createElement('li')
      const labelEl = document.createElement('span')
      labelEl.textContent = label
      const countEl = document.createElement('span')
      countEl.className = 'analytics-count'
      countEl.textContent = count
      li.append(labelEl, countEl)
      return li
    })
  )
}

function loadAlumni() {
  fetch(`/api/companies/${encodeURIComponent(companyName)}/alumni`)
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `API error: ${res.status}`)
      }
      return res.json()
    })
    .then((alumni) => {
      if (!alumni.length) {
        alumniStatusEl.textContent = 'No alumni currently listed at this company.'
        return
      }
      alumniStatusEl.hidden = true
      alumniCardsEl.replaceChildren(...alumni.map(renderAlumnus))
      renderBreakdown(analyticsFunctionEl, breakdownBy(alumni, 'ft_function'))
      renderBreakdown(analyticsLocationEl, breakdownBy(alumni, 'country'))
      alumniLayoutEl.hidden = false
    })
    .catch((err) => {
      alumniStatusEl.textContent = `Couldn't load alumni: ${err.message}`
    })
}

function formatSalary(job) {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`
  if (job.salary_min && job.salary_max && job.salary_min !== job.salary_max) {
    return `${fmt(job.salary_min)}–${fmt(job.salary_max)}`
  }
  if (job.salary_min || job.salary_max) return fmt(job.salary_min || job.salary_max)
  return null
}

function formatContract(job) {
  const readable = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const parts = [job.contract_time, job.contract_type].filter(Boolean).map(readable)
  return parts.length ? parts.join(', ') : null
}

function renderJob(job) {
  const li = document.createElement('li')
  li.className = 'job-card'

  const title = document.createElement('div')
  title.className = 'job-title'
  title.textContent = job.title
  li.append(title)

  const metaBits = [job.location, formatSalary(job), formatContract(job)].filter(Boolean)
  if (metaBits.length) {
    const meta = document.createElement('div')
    meta.className = 'job-meta'
    meta.textContent = metaBits.join(' · ')
    li.append(meta)
  }

  if (job.redirect_url) {
    const link = document.createElement('a')
    link.className = 'job-apply'
    link.href = job.redirect_url
    link.target = '_blank'
    link.rel = 'noopener'
    link.textContent = 'Apply →'
    li.append(link)
  }

  return li
}

function loadJobs() {
  fetch(`/api/companies/${encodeURIComponent(companyName)}/jobs`)
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `API error: ${res.status}`)
      }
      return res.json()
    })
    .then(({ jobs, warning }) => {
      if (warning) {
        jobsWarningEl.textContent = `Showing cached postings — live lookup failed: ${warning}`
        jobsWarningEl.hidden = false
      }
      if (!jobs.length) {
        jobsStatusEl.textContent = 'No current job postings found for this company.'
        return
      }
      jobsStatusEl.hidden = true
      jobsListEl.replaceChildren(...jobs.map(renderJob))
      jobsListEl.hidden = false
    })
    .catch((err) => {
      // Adzuna occasionally 400s on certain company names, and it's just
      // as often unreachable/misconfigured/rate-limited — none of that is
      // useful to show a visitor, so keep the message generic either way.
      console.error(`Failed to load job postings for ${companyName}:`, err)
      jobsStatusEl.textContent = 'No open listings found for this company right now.'
    })
}

if (!companyName) {
  nameEl.textContent = 'Company not found'
  statusEl.textContent = 'No company was specified.'
  alumniStatusEl.hidden = true
  jobsStatusEl.hidden = true
} else {
  nameEl.textContent = companyName
  loadAlumni()
  loadJobs()
}
