const companyName = new URLSearchParams(window.location.search).get('name')

const nameEl = document.getElementById('company-name')
const statusEl = document.getElementById('status')
const factsEl = document.getElementById('company-facts')
const countEl = document.getElementById('alumni-count')
const recentEl = document.getElementById('most-recent')

function formatMostRecent(company) {
  if (!company.most_recent_alumnus_first_name) return 'N/A'
  const grad = String(company.most_recent_alumnus_grad_year).slice(-2)
  return `${company.most_recent_alumnus_first_name} ${company.most_recent_alumnus_last_name} ('${grad})`
}

if (!companyName) {
  nameEl.textContent = 'Company not found'
  statusEl.textContent = 'No company was specified.'
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
}
