const companyName = new URLSearchParams(window.location.search).get('name')

const nameEl = document.getElementById('company-name')
const statusEl = document.getElementById('status')
const factsEl = document.getElementById('company-facts')
const countEl = document.getElementById('alumni-count')
const recentEl = document.getElementById('most-recent')
const logoEl = document.getElementById('company-logo')
const domainEl = document.getElementById('company-domain')
const industryEl = document.getElementById('industry')
const sizeEl = document.getElementById('company-size')
const headquartersEl = document.getElementById('headquarters')
const foundedEl = document.getElementById('year-founded')
const revenueEl = document.getElementById('revenue')
const typeEl = document.getElementById('company-type')
const descriptionEl = document.getElementById('company-description')
const enrichmentStatusEl = document.getElementById('enrichment-status')
const rolesSectionEl = document.getElementById('roles-section')
const rolesListEl = document.getElementById('roles-list')
const otherDataSectionEl = document.getElementById('other-data-section')
const tagsEl = document.getElementById('tags')
const linksEl = document.getElementById('company-links')

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

function setOptionalFact(element, value) {
  const hasValue = value !== null && value !== undefined && value !== ''
  element.hidden = !hasValue
  element.previousElementSibling.hidden = !hasValue
  element.textContent = hasValue ? value : ''
}

function safeExternalUrl(value) {
  if (!value) return null
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function renderRoles(roles) {
  if (!roles.length) return
  rolesListEl.replaceChildren(...roles.map((role) => {
    const li = document.createElement('li')
    li.textContent = `${role.title} (${role.alumni_count} alum${role.alumni_count === 1 ? '' : 'ni'})`
    return li
  }))
  rolesSectionEl.hidden = false
}

function addCompanyLink(label, value) {
  const href = safeExternalUrl(value)
  if (!href) return
  const link = document.createElement('a')
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener'
  link.textContent = label
  linksEl.append(link)
}

function renderCompanyLogo(logoValue, domain) {
  const abstractLogoUrl = safeExternalUrl(logoValue)
  const faviconFallback = domain
    ? `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(`https://${domain}`)}`
    : null
  const candidates = [abstractLogoUrl, faviconFallback].filter(Boolean)
  if (!candidates.length) return

  let index = 0
  logoEl.addEventListener('load', () => {
    logoEl.hidden = false
    nameEl.hidden = true
  })
  logoEl.addEventListener('error', () => {
    index += 1
    if (index < candidates.length) {
      logoEl.src = candidates[index]
    } else {
      logoEl.hidden = true
      nameEl.hidden = false
    }
  })
  logoEl.src = candidates[index]
}

function renderEnrichment(result) {
  renderRoles(result.comparable_roles || [])
  if (!result.available || !result.data) {
    enrichmentStatusEl.textContent = result.warning || 'Company enrichment is unavailable.'
    return
  }

  const data = result.data
  enrichmentStatusEl.hidden = true
  setOptionalFact(industryEl, data.industry)
  setOptionalFact(sizeEl, data.employee_range || data.employee_count)
  setOptionalFact(
    headquartersEl,
    [data.city, data.state, data.country].filter(Boolean).join(', ')
  )
  setOptionalFact(foundedEl, data.year_founded)
  setOptionalFact(revenueEl, data.revenue_range || data.annual_revenue)
  setOptionalFact(
    typeEl,
    [data.type, data.ticker, data.exchange].filter(Boolean).join(' · ')
  )

  const domainUrl = safeExternalUrl(result.domain)
  if (domainUrl) {
    domainEl.href = domainUrl
    domainEl.textContent = result.domain
    domainEl.hidden = false
  }
  logoEl.alt = `${data.company_name || companyName} logo`
  renderCompanyLogo(data.logo, result.domain)
  if (data.description) {
    descriptionEl.textContent = data.description
    descriptionEl.hidden = false
  }

  const technologies = data.technologies || data.tech_tags || []
  ;[...(data.tags || []), ...technologies].slice(0, 16).forEach((tag) => {
    const span = document.createElement('span')
    span.className = 'tag'
    span.textContent = tag
    tagsEl.append(span)
  })
  addCompanyLink('LinkedIn', data.linkedin_url)
  addCompanyLink('Crunchbase', data.crunchbase_url)
  addCompanyLink('Facebook', data.facebook_url)
  addCompanyLink('Instagram', data.instagram_url)
  addCompanyLink('X / Twitter', data.twitter_url)
  otherDataSectionEl.hidden = !tagsEl.children.length && !linksEl.children.length
}

function loadEnrichment() {
  fetch(`/api/companies/${encodeURIComponent(companyName)}/enrichment`)
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `API error: ${res.status}`)
      }
      return res.json()
    })
    .then(renderEnrichment)
    .catch((err) => {
      enrichmentStatusEl.textContent = `Couldn't load company enrichment: ${err.message}`
    })
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
  loadEnrichment()
}
