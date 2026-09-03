const companyName = new URLSearchParams(window.location.search).get('name')

const nameEl = document.getElementById('company-name')
const statusEl = document.getElementById('status')

const alumniStatusEl = document.getElementById('alumni-status')
const alumniLayoutEl = document.getElementById('alumni-layout')
const alumniCardsEl = document.getElementById('alumni-cards')
const analyticsFunctionEl = document.getElementById('analytics-function')
const analyticsLocationEl = document.getElementById('analytics-location')
const functionFilterEl = document.getElementById('function-filter')
const alumniCountLabelEl = document.getElementById('alumni-count-label')
const showMoreBtn = document.getElementById('alumni-show-more')

const ALUMNI_PAGE_SIZE = 12
let allAlumni = []
let functionFilter = ''
let visibleCount = ALUMNI_PAGE_SIZE

const factsEl = document.getElementById('company-facts')
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

function renderAlumnus(alum) {
  const card = document.createElement('div')
  card.className = 'alumni-card'

  const avatar = document.createElement('div')
  avatar.className = 'alumni-avatar'
  avatar.textContent = `${alum.first_name[0] || ''}${alum.last_name[0] || ''}`
  card.append(avatar)

  const body = document.createElement('div')
  body.className = 'alumni-body'

  const name = document.createElement('div')
  name.className = 'alumni-name'
  name.textContent = `${alum.first_name} ${alum.last_name}`
  body.append(name)

  const grad = document.createElement('div')
  grad.className = 'alumni-meta'
  grad.textContent = `Class of ${alum.graduating_year}`
  body.append(grad)

  if (alum.ft_title) {
    const title = document.createElement('div')
    title.className = 'alumni-meta'
    title.textContent = `Title: ${alum.ft_title}`
    body.append(title)
  }

  if (alum.ft_function) {
    const fn = document.createElement('div')
    fn.className = 'alumni-meta'
    fn.textContent = `Function: ${alum.ft_function}`
    body.append(fn)
  }

  const email = document.createElement('a')
  email.className = 'alumni-email'
  email.href = `mailto:${alum.email}`
  email.textContent = alum.email
  body.append(email)

  card.append(body)
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

function renderBreakdown(listEl, breakdown, { activeLabel, onSelect } = {}) {
  listEl.replaceChildren(
    ...breakdown.map(({ label, count }) => {
      const li = document.createElement('li')
      const labelEl = document.createElement('span')
      labelEl.textContent = label
      const countEl = document.createElement('span')
      countEl.className = 'analytics-count'
      countEl.textContent = count
      li.append(labelEl, countEl)
      if (onSelect) {
        li.classList.toggle('active', label === activeLabel)
        li.addEventListener('click', () => onSelect(label))
      }
      return li
    })
  )
}

function populateFunctionFilter(breakdown) {
  const totalCount = breakdown.reduce((sum, { count }) => sum + count, 0)
  functionFilterEl.replaceChildren(
    ...[{ label: '', text: `All functions (${totalCount})` }, ...breakdown.map(({ label, count }) => ({
      label,
      text: `${label} (${count})`,
    }))].map(({ label, text }) => {
      const option = document.createElement('option')
      option.value = label
      option.textContent = text
      return option
    })
  )
  functionFilterEl.value = functionFilter
}

function setFunctionFilter(label) {
  functionFilter = functionFilter === label ? '' : label
  visibleCount = ALUMNI_PAGE_SIZE
  renderAlumniList()
}

function renderAlumniList() {
  const filtered = functionFilter
    ? allAlumni.filter((alum) => (alum.ft_function || 'Unknown') === functionFilter)
    : allAlumni

  const visible = filtered.slice(0, visibleCount)
  alumniCardsEl.replaceChildren(...visible.map(renderAlumnus))

  const remaining = filtered.length - visible.length
  showMoreBtn.hidden = remaining <= 0
  showMoreBtn.textContent = `Show ${Math.min(remaining, ALUMNI_PAGE_SIZE)} more`

  alumniCountLabelEl.textContent = functionFilter
    ? `Showing ${visible.length} of ${filtered.length} in ${functionFilter} (${allAlumni.length} total)`
    : `Showing ${visible.length} of ${filtered.length}`

  renderBreakdown(analyticsFunctionEl, breakdownBy(allAlumni, 'ft_function'), {
    activeLabel: functionFilter,
    onSelect: setFunctionFilter,
  })
  functionFilterEl.value = functionFilter
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
      allAlumni = alumni
      functionFilter = ''
      visibleCount = ALUMNI_PAGE_SIZE
      populateFunctionFilter(breakdownBy(alumni, 'ft_function'))
      renderAlumniList()
      renderBreakdown(analyticsLocationEl, breakdownBy(alumni, 'country'))
      alumniLayoutEl.hidden = false
    })
    .catch((err) => {
      alumniStatusEl.textContent = `Couldn't load alumni: ${err.message}`
    })
}

functionFilterEl.addEventListener('change', () => {
  functionFilter = functionFilterEl.value
  visibleCount = ALUMNI_PAGE_SIZE
  renderAlumniList()
})

showMoreBtn.addEventListener('click', () => {
  visibleCount += ALUMNI_PAGE_SIZE
  renderAlumniList()
})

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
  factsEl.hidden = false
  setOptionalFact(industryEl, data.industry)
  const employeeCount =
    typeof data.employee_count === 'number' ? data.employee_count.toLocaleString() : data.employee_count
  setOptionalFact(sizeEl, data.employee_range || employeeCount)
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
  enrichmentStatusEl.hidden = true
  jobsStatusEl.hidden = true
} else {
  nameEl.textContent = companyName
  loadAlumni()
  loadJobs()
  loadEnrichment()
}
