const statusEl = document.getElementById('status')
const containerEl = document.getElementById('bubbles')
const emptyStateEl = document.getElementById('empty-state')
const searchEl = document.getElementById('company-search')
const chipsEl = document.getElementById('industry-chips')
const statEl = document.getElementById('stat')
const panelEl = document.getElementById('panel')
const panelTagEl = document.getElementById('panel-tag')
const panelNameEl = document.getElementById('panel-name')
const panelMetaEl = document.getElementById('panel-meta')
const panelCtaEl = document.getElementById('panel-cta')
const panelCloseEl = document.getElementById('panel-close')

let allCompanies = []
let renderedNodes = []
let node = null
let simulation = null
let activeIndustry = 'all'

const MIN_RADIUS = 3.3
const MAX_RADIUS = 26.4
const BUBBLE_DISPLAY_LIMIT = 25

// One fixed font size for every bubble — names that don't fit wrap onto
// additional lines instead of shrinking, so text weight/size stays
// consistent across the whole chart.
const NAME_FONT_SIZE = 4
const COUNT_FONT_SIZE = 3.3
const LINE_HEIGHT = NAME_FONT_SIZE * 1.2
const MAX_NAME_LINES = 3

// How much of a bubble's diameter a line of text is allowed to use before
// wrapping to the next line.
const NAME_WIDTH_FRACTION = 0.82

// Bubbles smaller than this (radius, in the same user units as MIN/MAX
// RADIUS) don't get any text at all — there's no room to wrap into.
const MIN_RADIUS_FOR_TEXT = 7.2

// How many steps to advance the force simulation before anything is drawn,
// so bubbles appear already settled instead of visibly jiggling into place.
const SETTLE_ITERATIONS = 300

// Fixed, readable categorical palette — used so color carries information
// (which industry a bubble belongs to), cycling if there are more
// industries in the data than swatches.
const PALETTE = ['#375D8C', '#1F8A78', '#A6414F', '#C89B3C', '#6A4E8C', '#B5502E', '#708238', '#A9762C']

function radiusScale(companies) {
  const max = d3.max(companies, (d) => d.alumni_count) || 1
  return d3.scaleSqrt().domain([0, max]).range([MIN_RADIUS, MAX_RADIUS])
}

function industryColorScale(companies) {
  const industries = [...new Set(companies.map((c) => c.industry || 'Other'))].sort()
  return d3.scaleOrdinal().domain(industries).range(PALETTE)
}

function render(companies) {
  containerEl.replaceChildren()
  if (simulation) simulation.stop()
  panelEl.classList.remove('show')

  if (companies.length === 0) {
    containerEl.hidden = true
    statusEl.hidden = false
    statusEl.textContent = 'No companies to show.'
    node = null
    renderedNodes = []
    return
  }
  statusEl.hidden = true
  containerEl.hidden = false

  const rScale = radiusScale(companies)
  const colorScale = industryColorScale(companies)
  const colorFor = (d) => colorScale(d.industry || 'Other')

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
  renderedNodes = nodes

  // The single largest bubble is fixed dead center (d3's fx/fy exempt a node
  // from every force below); every other bubble stays fully mobile, so the
  // rest settle around it under collision/repulsion rather than snapping to
  // fixed slots.
  const anchor = nodes[0]
  anchor.fx = 0
  anchor.fy = 0

  // Run the force simulation fully to convergence *before* anything is
  // appended to the DOM, so bubbles appear already in their settled
  // positions instead of visibly jiggling into place.
  simulation = d3
    .forceSimulation(nodes)
    .force('x', d3.forceX(0).strength(0.18))
    .force('y', d3.forceY(0).strength(0.22))
    .force('charge', d3.forceManyBody().strength(18))
    .force('collide', d3.forceCollide((d) => d.r + 0.5).iterations(6))
    .stop()
  for (let i = 0; i < SETTLE_ITERATIONS; i++) simulation.tick()

  // Fit the view to the bubbles' actual (non-square) bounding box, and
  // derive the SVG's pixel height from that box's aspect ratio against the
  // container's real width — so the displayed aspect always matches the
  // viewBox and the browser never has to letterbox with blank space.
  const PAD = 4
  const minX = d3.min(nodes, (d) => d.x - d.r) - PAD
  const maxX = d3.max(nodes, (d) => d.x + d.r) + PAD
  const minY = d3.min(nodes, (d) => d.y - d.r) - PAD
  const maxY = d3.max(nodes, (d) => d.y + d.r) + PAD
  const boxWidth = maxX - minX
  const boxHeight = maxY - minY
  const containerWidth = containerEl.clientWidth || boxWidth

  const svg = d3
    .select(containerEl)
    .append('svg')
    .attr('viewBox', `${minX} ${minY} ${boxWidth} ${boxHeight}`)
    .attr('width', '100%')
    .attr('height', containerWidth * (boxHeight / boxWidth))

  node = svg
    .selectAll('g.bubble')
    .data(nodes, (d) => d.company_name)
    .join('g')
    .attr('class', 'bubble')
    .attr('transform', (d) => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => openPanel(d, colorScale))

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
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', NAME_FONT_SIZE)
    .attr('font-weight', 600)
    .style('pointer-events', 'none')

  const countText = node
    .append('text')
    .attr('class', 'bubble-count')
    .text((d) => d.alumni_count)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('fill-opacity', 0.85)
    .attr('font-size', COUNT_FONT_SIZE)
    .style('pointer-events', 'none')

  // Wrap each company name onto as many lines as it needs (up to
  // MAX_NAME_LINES) instead of shrinking the font, so text stays one
  // consistent size across every bubble. Bubbles too small for even one
  // line get no text at all.
  nameText.each(function (d) {
    const textEl = d3.select(this)
    const nameGroup = d3.select(this.parentNode)
    const countEl = nameGroup.select('text.bubble-count')

    if (d.r < MIN_RADIUS_FOR_TEXT) {
      countEl.style('display', 'none')
      return
    }

    const maxWidth = d.r * 2 * NAME_WIDTH_FRACTION
    const words = d.company_name.split(/\s+/).filter(Boolean)
    const lines = []
    let current = ''

    // Measure using a throwaway tspan on the real (already-styled) text
    // node, so measurements reflect the actual rendered font.
    const measure = (t) => {
      textEl.text(t)
      return textEl.node().getComputedTextLength()
    }

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (measure(candidate) <= maxWidth || !current) {
        current = candidate
      } else {
        lines.push(current)
        current = word
      }
      if (lines.length === MAX_NAME_LINES) break
    }
    if (lines.length < MAX_NAME_LINES && current) lines.push(current)

    // Truncate with an ellipsis if there was more text than fit.
    const consumedWords = lines.join(' ').split(/\s+/).length
    if (consumedWords < words.length) {
      let last = lines[lines.length - 1]
      while (last.length > 1 && measure(`${last}…`) > maxWidth) {
        last = last.slice(0, -1)
      }
      lines[lines.length - 1] = `${last}…`
    }

    // Only show the alumni count if there's still vertical room below the
    // wrapped name for it.
    const showCount = (lines.length + 1) * LINE_HEIGHT <= d.r * 2 * 0.85
    const totalLines = lines.length + (showCount ? 1 : 0)
    const startY = -((totalLines - 1) * LINE_HEIGHT) / 2

    textEl.text(null)
    lines.forEach((line, i) => {
      textEl
        .append('tspan')
        .attr('x', 0)
        .attr('y', startY + i * LINE_HEIGHT)
        .text(line)
    })

    countEl.style('display', showCount ? null : 'none')
    if (showCount) {
      countEl.attr('y', startY + lines.length * LINE_HEIGHT)
    }
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

  applyDimming(false)
}

function openPanel(d, colorScale) {
  const color = colorScale(d.industry || 'Other')
  panelTagEl.innerHTML = `<span class="dot" style="background:${color}"></span>${d.industry || 'Other'}`
  panelNameEl.textContent = d.company_name
  panelMetaEl.innerHTML = `<b>${d.alumni_count}</b> CBS alumni currently work here`
  panelCtaEl.href = `company.html?name=${encodeURIComponent(d.company_name)}`
  panelEl.classList.add('show')
}

panelCloseEl.addEventListener('click', () => panelEl.classList.remove('show'))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') panelEl.classList.remove('show')
})

function renderChips(companies) {
  const industries = [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort()
  const colorScale = industryColorScale(companies)

  chipsEl.replaceChildren()

  const allChip = document.createElement('div')
  allChip.className = 'chip' + (activeIndustry === 'all' ? ' active' : '')
  allChip.textContent = 'All'
  allChip.onclick = () => {
    activeIndustry = 'all'
    renderChips(companies)
    applyDimming()
  }
  chipsEl.append(allChip)

  for (const industry of industries) {
    const chip = document.createElement('div')
    chip.className = 'chip' + (activeIndustry === industry ? ' active' : '')
    chip.innerHTML = `<span class="dot" style="background:${colorScale(industry)}"></span>${industry}`
    chip.onclick = () => {
      activeIndustry = industry
      renderChips(companies)
      applyDimming()
    }
    chipsEl.append(chip)
  }
}

// Filters by dimming bubbles in place, rather than re-running the
// simulation, so the layout stays stable while the user types or clicks a
// chip — matching/non-matching bubbles are just toggled visually.
function applyDimming(animate = true) {
  if (!node) return
  const search = searchEl.value.trim().toLowerCase()
  let anyVisible = false

  node.classed('dim', (d) => {
    const matchesSearch = !search || d.company_name.toLowerCase().startsWith(search)
    const matchesIndustry = activeIndustry === 'all' || d.industry === activeIndustry
    const match = matchesSearch && matchesIndustry
    if (match) anyVisible = true
    return !match
  })

  // Give matching bubbles a quick "pop" so the result of a new filter
  // reads as an event, not just a fade — skipped on the initial render,
  // which is already drawn in its settled state.
  if (animate) {
    node.classed('pop', false)
    void containerEl.offsetWidth // force reflow so the animation restarts from scratch
    node
      .filter(function () {
        return !d3.select(this).classed('dim')
      })
      .classed('pop', true)
  }

  emptyStateEl.classList.toggle('show', !anyVisible)
}

searchEl.addEventListener('input', applyDimming)

fetch('/api/companies')
  .then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  })
  .then((companies) => {
    allCompanies = companies.filter((c) => c.alumni_count > 0)

    const totalAlumni = d3.sum(allCompanies, (c) => c.alumni_count)
    statEl.innerHTML = `<b>${allCompanies.length}</b> companies &nbsp;·&nbsp; <b>${totalAlumni}</b> alumni tracked`

    const toRender =
      allCompanies.length > BUBBLE_DISPLAY_LIMIT
        ? allCompanies.slice().sort((a, b) => b.alumni_count - a.alumni_count).slice(0, BUBBLE_DISPLAY_LIMIT)
        : allCompanies

    renderChips(toRender)
    render(toRender)
  })
  .catch((err) => {
    statusEl.hidden = false
    containerEl.hidden = true
    statusEl.textContent = `Failed to load company data: ${err.message}`
  })
