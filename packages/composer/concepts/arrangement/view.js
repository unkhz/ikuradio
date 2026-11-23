// The page of the Arrangements in Learn: the ones there are, drawn as a session is drawn, with what each says. Nothing here is changed by hand; its
// fields are in Edit. It names no part: everything the page shows comes from /arrangements.json, built with textContent: the only innerHTML is the
// static markup below, which holds no data. The drawing itself is shared with Edit (shared.js).

const arrangementMarkup = `
<section aria-labelledby="arrangements">
        <h2 id="arrangements">Arrangements</h2>
        <div class="controls">
          <label>Arrangement <select id="which"></select></label>
          <label>Tempo <input id="tempo" type="number" min="20" max="300" step="1" value="72" /> bpm</label>
          <span id="total" class="total"></span>
        </div>
        <p id="about" class="about"></p>
        <div class="scroll"><div id="diagram" class="diagram"></div></div>
        <ul class="key" id="key"></ul>
        <table class="order" id="order"></table>
      </section>
`

function drawConcept(root, data) {
  root.innerHTML = arrangementMarkup
  let arrangements = data
  const viewer = { scroll: document.querySelector('#arrangements ~ .scroll'), diagram: $('diagram'), key: $('key'), order: $('order'), total: $('total') }

  function showArrangement() {
    const chosen = arrangements.find((a) => a.id === $('which').value) ?? arrangements[0]
    if (!chosen) {
      viewer.diagram.replaceChildren()
      return
    }
    $('about').textContent = chosen.text
    draw(chosen.layout, chosen.timeline, viewer)
  }

  async function load() {
    arrangements = await fetch(`/arrangements.json?tempo=${Number($('tempo').value) || 72}`).then((r) => r.json())
    const before = $('which').value
    $('which').replaceChildren(...arrangements.map((a) => el('option', { value: a.id, textContent: a.title })))
    if (arrangements.some((a) => a.id === before)) $('which').value = before
    showArrangement()
  }

  $('which').addEventListener('change', showArrangement)
  $('tempo').addEventListener('change', load)
  load()
}
