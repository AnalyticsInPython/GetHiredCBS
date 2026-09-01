const statusEl = document.getElementById('status')
const tableEl = document.getElementById('alumni-table')
const bodyEl = document.getElementById('alumni-body')
const filterEl = document.getElementById('company-filter')

let alumni = []

function renderRow(row) {
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td>${row.graduating_year ?? ''}</td>
    <td>${row.first_name ?? ''} ${row.last_name ?? ''}</td>
    <td>${row.status ?? ''}</td>
    <td>${row.ft_employer ?? ''}</td>
    <td>${row.ft_title ?? ''}</td>
    <td>${row.ft_industry ?? ''}</td>
    <td>${[row.city, row.state, row.country].filter(Boolean).join(', ')}</td>
  `
  return tr
}

function render(rows) {
  bodyEl.replaceChildren(...rows.map(renderRow))
}

filterEl.addEventListener('input', () => {
  const term = filterEl.value.trim().toLowerCase()
  const filtered = term
    ? alumni.filter((row) => (row.ft_employer ?? '').toLowerCase().includes(term))
    : alumni
  render(filtered)
})

fetch('/api/alumni')
  .then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  })
  .then((data) => {
    alumni = data
    render(alumni)
    statusEl.hidden = true
    tableEl.hidden = false
  })
  .catch((err) => {
    statusEl.textContent = `Failed to load alumni data: ${err.message}`
  })
