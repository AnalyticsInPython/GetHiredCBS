const companyName = new URLSearchParams(window.location.search).get('name')

const nameEl = document.getElementById('company-name')
const statusEl = document.getElementById('status')
const factsEl = document.getElementById('company-facts')
const countEl = document.getElementById('alumni-count')
const recentEl = document.getElementById('most-recent')

const jobsStatusEl = document.getElementById('jobs-status')
const jobsWarningEl = document.getElementById('jobs-warning')
const jobsListEl = document.getElementById('jobs-list')

function formatMostRecent(company) {
  if (!company.most_recent_alumnus_first_name) return 'N/A'
  const grad = String(company.most_recent_alumnus_grad_year).slice(-2)
  return `${company.most_recent_alumnus_first_name} ${company.most_recent_alumnus_last_name} ('${grad})`
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
      jobsStatusEl.textContent = `Couldn't load job postings: ${err.message}`
    })
}

if (!companyName) {
  nameEl.textContent = 'Company not found'
  statusEl.textContent = 'No company was specified.'
  jobsStatusEl.hidden = true
} else {
  nameEl.textContent = companyName

  fetch('/api/companies')
    .then((res) => {
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    })
    .then((companies) => {
      const company = companies.find((c) => c.company_name === companyName)
      if (!company) {
        statusEl.textContent = 'No data found for this company.'
        return
      }
      countEl.textContent = company.alumni_count
      recentEl.textContent = formatMostRecent(company)
      factsEl.hidden = false
    })
    .catch((err) => {
      statusEl.textContent = `Failed to load company data: ${err.message}`
    })

  loadJobs()
}
