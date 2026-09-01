const statusEl = document.getElementById('status')
const containerEl = document.getElementById('bubbles')
const industryFilterEl = document.getElementById('industry-filter')

let allCompanies = []

const MIN_RADIUS = 30
const MAX_RADIUS = 90

function radiusFor(count, maxCount) {
  const t = maxCount > 0 ? Math.sqrt(count / maxCount) : 0
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t
}

function colorFor(count, maxCount) {
  const t = maxCount > 0 ? count / maxCount : 0
  const lightness = 80 - t * 40 // more alumni -> deeper color
  return `hsl(210 65% ${lightness}%)`
}

function makeBubble(company, maxCount) {
  const radius = radiusFor(company.alumni_count, maxCount)
  const diameter = Math.round(radius * 2)

  const bubble = document.createElement('a')
  bubble.className = 'bubble'
  bubble.href = `company.html?name=${encodeURIComponent(company.company_name)}`
  bubble.title = `${company.company_name}: ${company.alumni_count} alumni`
  bubble.style.width = `${diameter}px`
  bubble.style.height = `${diameter}px`
  bubble.style.backgroundColor = colorFor(company.alumni_count, maxCount)
  bubble.style.fontSize = `${Math.max(11, Math.min(17, diameter / 8))}px`

  const name = document.createElement('span')
  name.className = 'bubble-name'
  name.textContent = company.company_name

  const count = document.createElement('span')
  count.className = 'bubble-count'
  count.textContent = company.alumni_count

  bubble.append(name, count)
  return bubble
}

function render(companies) {
  const maxCount = companies.reduce((max, c) => Math.max(max, c.alumni_count), 0)
  const bubbles = companies
    .slice()
    .sort((a, b) => b.alumni_count - a.alumni_count)
    .map((c) => makeBubble(c, maxCount))
  containerEl.replaceChildren(...bubbles)
}

function populateIndustryOptions(companies) {
  const industries = [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort()
  for (const industry of industries) {
    const option = document.createElement('option')
    option.value = industry
    option.textContent = industry
    industryFilterEl.append(option)
  }
}

function applyFilter() {
  const industry = industryFilterEl.value
  const filtered = industry ? allCompanies.filter((c) => c.industry === industry) : allCompanies
  render(filtered)
}

industryFilterEl.addEventListener('change', applyFilter)

fetch('/api/companies')
  .then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  })
  .then((companies) => {
    allCompanies = companies.filter((c) => c.alumni_count > 0)
    populateIndustryOptions(allCompanies)
    render(allCompanies)
    statusEl.hidden = true
    containerEl.hidden = false
  })
  .catch((err) => {
    statusEl.textContent = `Failed to load company data: ${err.message}`
  })
