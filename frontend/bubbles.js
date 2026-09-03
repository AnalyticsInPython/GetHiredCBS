const statusEl = document.getElementById('status')
const containerEl = document.getElementById('bubbles')
const emptyStateEl = document.getElementById('empty-state')
const searchEl = document.getElementById('company-search')
const chipsEl = document.getElementById('industry-chips')
const statEl = document.getElementById('stat')
const panelEl = document.getElementById('panel')
const panelTagEl = document.getElementById('panel-tag')
const panelLogoEl = document.getElementById('panel-logo')
const panelNameEl = document.getElementById('panel-name')
const panelDomainEl = document.getElementById('panel-domain')
const panelMetaEl = document.getElementById('panel-meta')
const panelFactsEl = document.getElementById('panel-facts')
const panelIndustryEl = document.getElementById('panel-industry')
const panelSizeEl = document.getElementById('panel-size')
const panelHeadquartersEl = document.getElementById('panel-headquarters')
const panelFoundedEl = document.getElementById('panel-founded')
const panelCtaEl = document.getElementById('panel-cta')
const panelCloseEl = document.getElementById('panel-close')

let allCompanies = []
let node = null
let simulation = null
let activeIndustry = 'all'
// Bumped on every panel open so a slow enrichment fetch for a company the
// user has since clicked away from can't land its data in the panel late.
let panelRequestToken = 0
// Built once from every company, so an industry keeps the same color no
// matter what's currently filtered/visible — a scale built from just the
// currently-shown subset reassigns colors as that subset's set of
// industries changes (e.g. searching down to one company would always
// render it as the first palette color, regardless of its real industry).
let globalColorScale = null

const MIN_RADIUS = 4.6
const MAX_RADIUS = 39.1
const BUBBLE_DISPLAY_LIMIT = 25

// Font size scales with each bubble's own radius — bigger bubbles get
// bigger text — and then shrinks further per-name (down to
// FLOOR_NAME_FONT_SIZE) whenever needed so the full company name always
// wraps to fit, instead of ever being cut off with an ellipsis.
const MIN_NAME_FONT_SIZE = 3.9
const MAX_NAME_FONT_SIZE = 8.05
const FLOOR_NAME_FONT_SIZE = 2.5
const FONT_SHRINK_STEP = 0.25
const COUNT_FONT_RATIO = 0.75

// How much of a bubble's diameter a line of text is allowed to use before
// wrapping to the next line.
const NAME_WIDTH_FRACTION = 0.82

// Bubbles smaller than this (radius, in the same user units as MIN/MAX
// RADIUS) don't get any text at all — there's no room to wrap into.
const MIN_RADIUS_FOR_TEXT = 10.4

// How many steps to advance the force simulation before anything is drawn,
// so bubbles appear already settled instead of visibly jiggling into place.
const SETTLE_ITERATIONS = 300

// One color per industry — 11 swatches for the 11 industries the data
// actually has, so none has to repeat (a shorter list cycles and silently
// gives two unrelated industries the same color). All 11 share the same
// saturation/lightness (evenly-spaced hues, muted 40%/45% HSL) so they read
// as one cohesive, soft-toned set rather than a mix of harsher, unevenly
// saturated colors.
const PALETTE = [
  '#A14545', // dusty red / terracotta
  '#A17345', // dusty orange-brown
  '#A1A145', // dusty olive
  '#73A145', // dusty yellow-green
  '#45A145', // dusty green
  '#45A173', // dusty teal-green
  '#45A1A1', // dusty teal
  '#4573A1', // dusty steel blue
  '#4545A1', // dusty indigo
  '#7345A1', // dusty violet
  '#A14573', // dusty rose
]

function radiusScale(companies) {
  const max = d3.max(companies, (d) => d.alumni_count) || 1
  return d3.scaleSqrt().domain([0, max]).range([MIN_RADIUS, MAX_RADIUS])
}

function industryColorScale(companies) {
  const industries = [...new Set(companies.map((c) => c.industry || 'Other'))].sort()
  return d3.scaleOrdinal().domain(industries).range(PALETTE)
}

// Bigger bubbles get bigger name text; radii at or below MIN_RADIUS_FOR_TEXT
// (which get no text at all) map to the smallest size.
function nameFontScale(r) {
  const t = Math.min(1, Math.max(0, (r - MIN_RADIUS_FOR_TEXT) / (MAX_RADIUS - MIN_RADIUS_FOR_TEXT)))
  return MIN_NAME_FONT_SIZE + t * (MAX_NAME_FONT_SIZE - MIN_NAME_FONT_SIZE)
}

// Renders exactly the given companies as bubbles — callers (applyFilter,
// below) are responsible for handling the empty case before reaching here.
function render(companies) {
  containerEl.replaceChildren()
  if (simulation) simulation.stop()
  panelEl.classList.remove('show')
  statusEl.hidden = true
  containerEl.hidden = false

  const rScale = radiusScale(companies)
  const colorScale = globalColorScale
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
    .attr('font-size', (d) => nameFontScale(d.r))
    .attr('font-weight', 600)
    .style('pointer-events', 'none')

  const countText = node
    .append('text')
    .attr('class', 'bubble-count')
    .text((d) => d.alumni_count)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff')
    .attr('fill-opacity', 0.85)
    .attr('font-size', (d) => nameFontScale(d.r) * COUNT_FONT_RATIO)
    .style('pointer-events', 'none')

  // Wrap each company name to fit its own bubble, shrinking the font size
  // (down to FLOOR_NAME_FONT_SIZE) as far as needed so every word wraps in —
  // never cutting the name short with an ellipsis. Bubbles too small for
  // even one line get no text at all.
  nameText.each(function (d) {
    const textEl = d3.select(this)
    const nameGroup = d3.select(this.parentNode)
    const countEl = nameGroup.select('text.bubble-count')

    if (d.r < MIN_RADIUS_FOR_TEXT) {
      countEl.style('display', 'none')
      return
    }

    const maxWidth = d.r * 2 * NAME_WIDTH_FRACTION
    const maxHeight = d.r * 2 * 0.85
    const words = d.company_name.split(/\s+/).filter(Boolean)

    // Measure using the real (already-styled) text node, so measurements
    // reflect the actual rendered font at whatever size is currently set.
    const measure = (t) => {
      textEl.text(t)
      return textEl.node().getComputedTextLength()
    }

    // Greedily wraps words at the given width. Normally bails out (returns
    // null) if a single word alone is too wide, so the caller can shrink the
    // font and retry — unless allowOverflow is set, in which case that word
    // just gets its own (possibly overflowing) line instead of being cut.
    const wrapWords = (maxW, allowOverflow) => {
      const result = []
      let current = ''
      for (const word of words) {
        if (!allowOverflow && measure(word) > maxW) return null
        const candidate = current ? `${current} ${word}` : word
        if (current && measure(candidate) <= maxW) {
          current = candidate
        } else {
          if (current) result.push(current)
          current = word
        }
      }
      if (current) result.push(current)
      return result
    }

    // Start from a font size proportional to this bubble's own radius, then
    // shrink until the full name wraps within it both horizontally and
    // vertically.
    let fontSize = nameFontScale(d.r)
    let lines = null
    for (; fontSize >= FLOOR_NAME_FONT_SIZE; fontSize -= FONT_SHRINK_STEP) {
      textEl.attr('font-size', fontSize)
      const wrapped = wrapWords(maxWidth)
      if (wrapped && wrapped.length * (fontSize * 1.2) <= maxHeight) {
        lines = wrapped
        break
      }
    }
    // Last resort for a pathologically long single word in a tiny bubble:
    // render at the floor size and let that one word overflow the bubble's
    // circle slightly, rather than ever truncating the name.
    if (!lines) {
      fontSize = FLOOR_NAME_FONT_SIZE
      textEl.attr('font-size', fontSize)
      lines = wrapWords(maxWidth, true)
    }

    const lineHeight = fontSize * 1.2

    // Only show the alumni count if there's still vertical room below the
    // wrapped name for it.
    const showCount = (lines.length + 1) * lineHeight <= maxHeight
    const totalLines = lines.length + (showCount ? 1 : 0)
    const startY = -((totalLines - 1) * lineHeight) / 2

    textEl.text(null)
    lines.forEach((line, i) => {
      textEl
        .append('tspan')
        .attr('x', 0)
        .attr('y', startY + i * lineHeight)
        .text(line)
    })

    countEl.attr('font-size', fontSize * COUNT_FONT_RATIO)
    countEl.style('display', showCount ? null : 'none')
    if (showCount) {
      countEl.attr('y', startY + lines.length * lineHeight)
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

  simulation = d3
    .forceSimulation(nodes)
    .force('x', d3.forceX(0).strength(0.18))
    .force('y', d3.forceY(0).strength(0.22))
    .force('charge', d3.forceManyBody().strength(18))
    .force('collide', d3.forceCollide((d) => d.r + 0.5).iterations(6))
    .on('tick', () => {
      // No hard position clamp here on purpose: forcing nodes back inside a
      // fixed boundary mid-simulation fights the collision force exactly
      // where the fixed center anchor already crowds everything else, which
      // was producing real, persistent overlaps. Instead the viewBox itself
      // is refit to the current positions every tick, below.
      //
      // The viewBox is fit to the bubbles' actual (non-square) bounding
      // box, and the SVG's pixel height is derived from that box's aspect
      // ratio against the container's real width — so the box's aspect
      // ratio always matches what's displayed and the browser never has to
      // letterbox (pad with blank space) to preserve a mismatched aspect.
      const PAD = 8
      const minX = d3.min(nodes, (d) => d.x - d.r) - PAD
      const maxX = d3.max(nodes, (d) => d.x + d.r) + PAD
      const minY = d3.min(nodes, (d) => d.y - d.r) - PAD
      const maxY = d3.max(nodes, (d) => d.y + d.r) + PAD
      const boxWidth = maxX - minX
      const boxHeight = maxY - minY
      const containerWidth = containerEl.clientWidth || boxWidth

      svg
        .attr('viewBox', `${minX} ${minY} ${boxWidth} ${boxHeight}`)
        .attr('height', containerWidth * (boxHeight / boxWidth))
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })
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

function setPanelFact(ddEl, value) {
  const hasValue = value !== null && value !== undefined && value !== ''
  ddEl.closest('.panel-fact').hidden = !hasValue
  ddEl.textContent = hasValue ? value : ''
}

function renderPanelLogo(logoValue, domain) {
  const abstractLogoUrl = safeExternalUrl(logoValue)
  const faviconFallback = domain
    ? `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(`https://${domain}`)}`
    : null
  const candidates = [abstractLogoUrl, faviconFallback].filter(Boolean)
  if (!candidates.length) return

  let index = 0
  panelLogoEl.onload = () => {
    panelLogoEl.hidden = false
  }
  panelLogoEl.onerror = () => {
    index += 1
    if (index < candidates.length) {
      panelLogoEl.src = candidates[index]
    } else {
      panelLogoEl.hidden = true
    }
  }
  panelLogoEl.src = candidates[index]
}

// Populates the mini panel's logo/website/facts from the same enrichment
// endpoint the in-depth company detail page uses — a subset (industry,
// size, headquarters, founded) of what that page shows in full.
function renderPanelEnrichment(result) {
  if (!result || !result.available || !result.data) return
  const data = result.data

  setPanelFact(panelIndustryEl, data.industry)
  const employeeCount =
    typeof data.employee_count === 'number' ? data.employee_count.toLocaleString() : data.employee_count
  setPanelFact(panelSizeEl, data.employee_range || employeeCount)
  setPanelFact(panelHeadquartersEl, [data.city, data.state, data.country].filter(Boolean).join(', '))
  setPanelFact(panelFoundedEl, data.year_founded)
  panelFactsEl.hidden = ![panelIndustryEl, panelSizeEl, panelHeadquartersEl, panelFoundedEl].some(
    (el) => !el.closest('.panel-fact').hidden
  )

  const domainUrl = safeExternalUrl(result.domain)
  if (domainUrl) {
    panelDomainEl.href = domainUrl
    panelDomainEl.textContent = result.domain
    panelDomainEl.hidden = false
  }

  panelLogoEl.alt = `${data.company_name || ''} logo`
  renderPanelLogo(data.logo, result.domain)
}

function openPanel(d, colorScale) {
  const color = colorScale(d.industry || 'Other')
  panelTagEl.innerHTML = `<span class="dot" style="background:${color}"></span>${d.industry || 'Other'}`
  panelNameEl.textContent = d.company_name
  panelMetaEl.innerHTML = `<b>${d.alumni_count}</b> CBS alumni currently work here`
  panelCtaEl.href = `company.html?name=${encodeURIComponent(d.company_name)}`
  panelEl.classList.add('show')

  // Clear the previous company's logo/website/facts immediately so nothing
  // stale is visible while this company's enrichment loads.
  panelLogoEl.hidden = true
  panelLogoEl.removeAttribute('src')
  panelDomainEl.hidden = true
  panelFactsEl.hidden = true

  const requestId = ++panelRequestToken
  fetch(`/api/companies/${encodeURIComponent(d.company_name)}/enrichment`)
    .then((res) => (res.ok ? res.json() : null))
    .then((result) => {
      if (requestId !== panelRequestToken) return
      renderPanelEnrichment(result)
    })
    .catch(() => {})
}

panelCloseEl.addEventListener('click', () => panelEl.classList.remove('show'))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') panelEl.classList.remove('show')
})

function renderChips(companies) {
  const industries = [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort()
  const colorScale = globalColorScale

  chipsEl.replaceChildren()

  const allChip = document.createElement('div')
  allChip.className = 'chip' + (activeIndustry === 'all' ? ' active' : '')
  allChip.textContent = 'All'
  allChip.onclick = () => {
    activeIndustry = 'all'
    renderChips(companies)
    applyFilter()
  }
  chipsEl.append(allChip)

  for (const industry of industries) {
    const chip = document.createElement('div')
    chip.className = 'chip' + (activeIndustry === industry ? ' active' : '')
    chip.innerHTML = `<span class="dot" style="background:${colorScale(industry)}"></span>${industry}`
    chip.onclick = () => {
      activeIndustry = industry
      renderChips(companies)
      applyFilter()
    }
    chipsEl.append(chip)
  }
}

// Matches companies against the search/industry filters out of the full
// list — not just whatever's currently on screen — so a search can surface
// a smaller company that never made the initial top-25 cut. Still capped to
// BUBBLE_DISPLAY_LIMIT, but only when the filtered result itself is over
// that limit (i.e. no filter active), never below it. Non-matching bubbles
// are actually removed via a fresh render(), not dimmed in place.
function applyFilter() {
  const search = searchEl.value.trim().toLowerCase()
  const matches = allCompanies.filter((c) => {
    const matchesSearch = !search || c.company_name.toLowerCase().startsWith(search)
    const matchesIndustry = activeIndustry === 'all' || c.industry === activeIndustry
    return matchesSearch && matchesIndustry
  })

  const visible =
    matches.length > BUBBLE_DISPLAY_LIMIT
      ? matches.slice().sort((a, b) => b.alumni_count - a.alumni_count).slice(0, BUBBLE_DISPLAY_LIMIT)
      : matches

  if (visible.length === 0) {
    if (simulation) simulation.stop()
    containerEl.replaceChildren()
    containerEl.hidden = true
    statusEl.hidden = true
    panelEl.classList.remove('show')
    node = null
    emptyStateEl.classList.add('show')
    return
  }

  emptyStateEl.classList.remove('show')
  render(visible)
}

function debounce(fn, delayMs) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delayMs)
  }
}

// Debounced so fast typing doesn't tear down and restart the bubble
// simulation on every keystroke — chip clicks (single, discrete) go
// straight to applyFilter with no delay.
searchEl.addEventListener('input', debounce(applyFilter, 150))

fetch('/api/companies')
  .then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  })
  .then((companies) => {
    allCompanies = companies.filter((c) => c.alumni_count > 0)
    globalColorScale = industryColorScale(allCompanies)

    const totalAlumni = d3.sum(allCompanies, (c) => c.alumni_count)
    statEl.innerHTML = `<b>${allCompanies.length}</b> companies &nbsp;·&nbsp; <b>${totalAlumni}</b> alumni tracked`

    renderChips(allCompanies)
    applyFilter()
  })
  .catch((err) => {
    statusEl.hidden = false
    containerEl.hidden = true
    statusEl.textContent = `Failed to load company data: ${err.message}`
  })
