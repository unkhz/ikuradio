// Drawn from step 6 of the plan "Evolution of Song"; until then the page says so.
function drawConcept(root, data) {
  root.append(el('p', { className: 'pending', textContent: `This page is not drawn yet: it comes in ${data.comes.toLowerCase()} of the plan.` }))
}
