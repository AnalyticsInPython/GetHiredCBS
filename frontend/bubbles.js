const statusEl = document.getElementById('status')
const containerEl = document.getElementById('bubbles')
const industryFilterEl = document.getElementById('industry-filter')

let allCompanies = []
let simulation = null

const MIN_RADIUS = 16
const MAX_RADIUS = 150

// Base font sizes, before the shrink-to-fit safety net below runs. Uses the
// same sqrt(alumni_count) curve as radiusScale, over the same domain, so
// font size tracks bubble size directly rather than saturating against a
// fixed r/divisor ceiling that only suits one particular radius range.
const NAME_FONT_RANGE = [9, 30]
const COUNT_FONT_RANGE = [8, 20]

// How much of a bubble's diameter its name text is allowed to use before
// getting shrunk to fit.
const NAME_WIDTH_FRACTION = 0.82
const MIN_NAME_FONT_SIZE = 6

// Fixed, readable categorical palette — used when bubbles span multiple
// industries, so color still carries information (which industry).
const PALETTE = ['#5B84C4', '#D64545', '#D6A324', '#8A63C9', '#3FA796', '#E07A5F', '#5C946E', '#B56576']

function radiusScale(companies) {
  const max = d3.max(companies, (d) => d.alumni_count) || 1
  return d3.scaleSqrt().domain([0, max]).range([MIN_RADIUS, MAX_RADIUS])
}

function fontScale(companies, range) {
  const max = d3.max(companies, (d) => d.alumni_count) || 1
  return d3.scaleSqrt().domain([0, max]).range(range)
}

function industryColorScale(companies) {
  const industries = [...new Set(companies.map((c) => c.industry || 'Other'))].sort()
  return d3.scaleOrdinal().domain(industries).range(PALETTE)
}

// Shades of blue only, darker = more alumni. Anchored a bit above pure white
// at the low end (0.32 instead of 0) so even the smallest bubble keeps
// enough contrast for white text. Only used once an industry filter is
// applied — at that point every bubble shares one industry, so color would
// otherwise carry no information; size-by-shade fills that gap instead.
function sizeColorScale(companies) {
  const [min, max] = d3.extent(companies, (d) => d.alumni_count)
  return d3
    .scaleSequential((t) => d3.interpolateBlues(0.32 + 0.65 * t))
    .domain([min ?? 0, max ?? 1])
}

function render(companies, { filtered = false } = {}) {
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
  const nameFontScale = fontScale(companies, NAME_FONT_RANGE)
  const countFontScale = fontScale(companies, COUNT_FONT_RANGE)
  let colorFor
  if (filtered) {
    const scale = sizeColorScale(companies)
    colorFor = (d) => scale(d.alumni_count)
  } else {
    const scale = industryColorScale(companies)
    colorFor = (d) => scale(d.industry || 'Other')
  }

  // Coordinates are centered on (0,0), which is where the biggest bubble
  // gets pinned below — everything else starts near it and drifts outward
  // under the simulation's own forces.
  const nodes = companies
    .slice()
    .sort((a, b) => b.alumni_count - a.alumni_count)
    .map((c) => ({
      ...c,
      r: rScale(c.alumni_count),
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
    }))

  // The single largest bubble is fixed dead center (d3's fx/fy exempt a node
  // from every force below); every other bubble stays fully mobile, so the
  // rest settle and jiggle around it under collision/repulsion rather than
  // snapping to fixed slots.
  const anchor = nodes[0]
  anchor.fx = 0
  anchor.fy = 0

  // Size the view so its own area is a fixed multiple of total bubble area
  // (packing-density target ~1/PACKING_LOOSENESS) — NOT sqrt(totalArea * k),
  // which doesn't track area at all and was quietly leaving ~90% of the
  // canvas empty, forcing the "fix" of an unbounded canvas that zoomed the
  // whole chart out instead of actually giving the bubbles more room.
  const PACKING_LOOSENESS = 1.5 // canvasArea ≈ 1.5x totalArea; lower = tighter fit, more overlap risk
  const totalArea = d3.sum(nodes, (d) => Math.PI * d.r ** 2)
  const half = Math.max(220, Math.min(900, 0.5 * Math.sqrt(PACKING_LOOSENESS * totalArea)))
  const viewSize = half * 2

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `${-half} ${-half} ${viewSize} ${viewSize}`)
    .attr('width', '100%')
    .attr('height', Math.min(viewSize, window.innerHeight * 0.88))
    .style('max-height', '88vh')

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
    .attr('fill', colorFor)
    .attr('fill-opacity', 0.92)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)

  node.append('title').text((d) => `${d.company_name}: ${d.alumni_count} alumni`)

  const nameText = node
    .append('text')
    .attr('class', 'bubble-name')
    .text((d) => d.company_name)
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.2em')
    .attr('fill', '#fff')
    .attr('font-size', (d) => nameFontScale(d.alumni_count))
    .attr('font-weight', 600)
    .style('pointer-events', 'none')

  node
    .append('text')
    .attr('class', 'bubble-count')
    .text((d) => d.alumni_count)
    .attr('text-anchor', 'middle')
    .attr('dy', '1.1em')
    .attr('fill', '#fff')
    .attr('fill-opacity', 0.85)
    .attr('font-size', (d) => countFontScale(d.alumni_count))
    .style('pointer-events', 'none')

  // Shrink-to-fit: measure each name's actual rendered width against the
  // bubble it's in, and scale both lines of text down together if it
  // overflows — rather than hiding names in small bubbles altogether.
  nameText.each(function (d) {
    const maxWidth = d.r * 2 * NAME_WIDTH_FRACTION
    const measuredWidth = this.getComputedTextLength()
    if (measuredWidth <= maxWidth) return

    const scale = maxWidth / measuredWidth
    const nameEl = d3.select(this)
    const countEl = d3.select(this.parentNode).select('text.bubble-count')
    nameEl.attr('font-size', Math.max(MIN_NAME_FONT_SIZE, parseFloat(nameEl.attr('font-size')) * scale))
    countEl.attr(
      'font-size',
      Math.max(MIN_NAME_FONT_SIZE - 1, parseFloat(countEl.attr('font-size')) * scale)
    )
  })

  const HOVER_GROWTH = 1.12

  node
    .on('mouseenter', function (event, d) {
      d3.select(this)
        .select('circle')
        .attr('r', d.r * HOVER_GROWTH)
        .attr('fill-opacity', 1)
        .attr('stroke-width', 3)
    })
    .on('mouseleave', function (event, d) {
      d3.select(this)
        .select('circle')
        .attr('r', d.r)
        .attr('fill-opacity', 0.88)
        .attr('stroke-width', 1.5)
    })

  simulation = d3
    .forceSimulation(nodes)
    .force('x', d3.forceX(0).strength(0.05))
    .force('y', d3.forceY(0).strength(0.06))
    .force('charge', d3.forceManyBody().strength(10))
    .force('collide', d3.forceCollide((d) => d.r + 3).iterations(6))
    .on('tick', () => {
      // No hard position clamp here on purpose: forcing nodes back inside a
      // fixed boundary mid-simulation fights the collision force exactly
      // where the fixed center anchor already crowds everything else, which
      // was producing real, persistent overlaps. Instead the viewBox itself
      // is refit to the current positions every tick, below — the settled
      // layout can end up needing more room than the pre-simulation estimate
      // (PACKING_LOOSENESS is only a starting guess), so this both prevents
      // bubbles from ever clipping past the edge and keeps the frame as
      // tight as it can be at every moment, maximizing how much of it the
      // bubbles actually fill.
      const requiredHalf =
        d3.max(nodes, (d) => Math.max(Math.abs(d.x) + d.r, Math.abs(d.y) + d.r)) + 8
      const requiredSize = requiredHalf * 2
      svg
        .attr('viewBox', `${-requiredHalf} ${-requiredHalf} ${requiredSize} ${requiredSize}`)
        .attr('height', Math.min(requiredSize, window.innerHeight * 0.88))
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

const BUBBLE_DISPLAY_LIMIT = 25

function applyFilter() {
  const industry = industryFilterEl.value
  const matching = industry ? allCompanies.filter((c) => c.industry === industry) : allCompanies
  // Only cap when there'd be too many to show — a filtered-down set under the
  // limit should render in full, not just whatever survived an earlier cut.
  const toRender =
    matching.length > BUBBLE_DISPLAY_LIMIT
      ? matching.slice().sort((a, b) => b.alumni_count - a.alumni_count).slice(0, BUBBLE_DISPLAY_LIMIT)
      : matching
  render(toRender, { filtered: Boolean(industry) })
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
    applyFilter()
  })
  .catch((err) => {
    statusEl.hidden = false
    containerEl.hidden = true
    statusEl.textContent = `Failed to load company data: ${err.message}`
  })
