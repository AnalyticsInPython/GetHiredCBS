const statusEl = document.getElementById('status')
const containerEl = document.getElementById('bubbles')
const industryFilterEl = document.getElementById('industry-filter')

let allCompanies = []
let simulation = null

const MIN_RADIUS = 10
const MAX_RADIUS = 110
const WIDTH = window.innerWidth || 900

// Fixed, readable categorical palette
const PALETTE = ['#5B84C4', '#D64545', '#D6A324', '#8A63C9', '#3FA796', '#E07A5F', '#5C946E', '#B56576']

function radiusScale(companies) {
  const max = d3.max(companies, (d) => d.alumni_count) || 1
  return d3.scaleSqrt().domain([0, max]).range([MIN_RADIUS, MAX_RADIUS])
}

function colorScale(companies) {
  const industries = [...new Set(companies.map((c) => c.industry || 'Other'))].sort()
  return d3.scaleOrdinal().domain(industries).range(PALETTE)
}

function render(companies) {
  containerEl.replaceChildren()
  if (simulation) simulation.stop()

  if (companies.length === 0) {
    containerEl.hidden = true
    statusEl.hidden = false
    statusEl.textContent = 'No companies match this filter.'
    return
  }
  statusEl.hidden = true
  containerEl.hidden = false

  const rScale = radiusScale(companies)
  const cScale = colorScale(companies)

  // Pick a height so the bubbles' combined area comfortably fits WIDTH x HEIGHT,
  // then clamp it to a sane on-screen range instead of a fixed constant.
  const totalArea = d3.sum(companies, (c) => Math.PI * rScale(c.alumni_count) ** 2)
  const HEIGHT = Math.max(320, Math.min(640, (totalArea * 1.7) / WIDTH))

  const nodes = companies
    .slice()
    .sort((a, b) => b.alumni_count - a.alumni_count)
    .map((c) => ({
      ...c,
      r: rScale(c.alumni_count),
      x: WIDTH / 2 + (Math.random() - 0.5) * 200,
      y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
    }))

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .attr('width', '100%')
    .attr('height', HEIGHT)
    .style('max-height', '75vh')

  const node = svg
    .selectAll('g.bubble')
    .data(nodes, (d) => d.company_name)
    .join('g')
    .attr('class', 'bubble')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      window.location.href = `company.html?name=${encodeURIComponent(d.company_name)}`
    })

  node
    .append('circle')
    .attr('r', (d) => d.r)
    .attr('fill', (d) => cScale(d.industry || 'Other'))
    .attr('fill-opacity', 0.88)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)

  node.append('title').text((d) => `${d.company_name}: ${d.alumni_count} alumni`)

  node
    .append('text')
    .text((d) => (d.r > 22 ? d.company_name : ''))
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.2em')
    .attr('fill', '#fff')
    .attr('font-size', (d) => Math.max(10, Math.min(15, d.r / 4.2)))
    .attr('font-weight', 600)
    .style('pointer-events', 'none')

  node
    .append('text')
    .text((d) => (d.r > 22 ? d.alumni_count : ''))
    .attr('text-anchor', 'middle')
    .attr('dy', '1.1em')
    .attr('fill', '#fff')
    .attr('fill-opacity', 0.85)
    .attr('font-size', (d) => Math.max(9, Math.min(13, d.r / 5.2)))
    .style('pointer-events', 'none')

  node
    .on('mouseenter', function () {
      d3.select(this).select('circle').attr('fill-opacity', 1).attr('stroke-width', 3)
    })
    .on('mouseleave', function () {
      d3.select(this).select('circle').attr('fill-opacity', 0.88).attr('stroke-width', 1.5)
    })

  simulation = d3
    .forceSimulation(nodes)
    .force('x', d3.forceX(WIDTH / 2).strength(0.12))
    .force('y', d3.forceY(HEIGHT / 2).strength(0.15))
    .force('charge', d3.forceManyBody().strength(6))
    .force('collide', d3.forceCollide((d) => d.r + 1).iterations(3))
    .on('tick', () => {
      for (const d of nodes) {
        d.x = Math.max(d.r, Math.min(WIDTH - d.r, d.x))
        d.y = Math.max(d.r, Math.min(HEIGHT - d.r, d.y))
      }
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })
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
    allCompanies = companies
      .filter((c) => c.alumni_count > 0)
      .sort((a, b) => b.alumni_count - a.alumni_count)
      .slice(0, 25)
    populateIndustryOptions(allCompanies)
    render(allCompanies)
  })
  .catch((err) => {
    statusEl.hidden = false
    containerEl.hidden = true
    statusEl.textContent = `Failed to load company data: ${err.message}`
  })
