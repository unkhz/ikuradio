// The matrix: a field of light seen through a grid of dots, one dot to a
// cell. As behind the page, a dot's size is how much light falls in its
// cell, and its colour is the colour of that light. A dot looks at its
// whole cell, not only its centre, so a thin stroke becomes a row of small
// dots rather than vanishing between them.
const looks = 4;
/** The light a whole cell sees: the mean over a few points spread across it. */
export function within(field, x, y, step) {
    let [r, g, b, energy] = [0, 0, 0, 0];
    for (let i = 0; i < looks; i++) {
        for (let j = 0; j < looks; j++) {
            const light = field(x + ((i + 0.5) / looks) * step, y + ((j + 0.5) / looks) * step);
            if (!light || light.energy <= 0)
                continue;
            r += light.color[0] * light.energy;
            g += light.color[1] * light.energy;
            b += light.color[2] * light.energy;
            energy += light.energy;
        }
    }
    if (energy <= 0)
        return undefined;
    return { color: [r / energy, g / energy, b / energy], energy: energy / (looks * looks) };
}
const channel = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255)
    .toString(16)
    .padStart(2, '0');
export const colorOf = (light) => `#${light.color.map(channel).join('')}`;
export function sample(field, grid) {
    const { columns, rows, from, step, at = [0, 0], pitch = 1, smallest = 0.08, largest = 0.47, unlit } = grid;
    const dots = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const light = within(field, from[0] + column * step, from[1] + row * step, step);
            const x = at[0] + (column + 0.5) * pitch;
            const y = at[1] + (row + 0.5) * pitch;
            if (light && light.energy >= 0.035) {
                const energy = Math.min(1, light.energy);
                dots.push({ x, y, r: pitch * (smallest + (largest - smallest) * energy), color: colorOf(light) });
            }
            else if (unlit) {
                dots.push({ x, y, r: pitch * (smallest + (largest - smallest) * unlit.energy), color: colorOf(unlit) });
            }
        }
    }
    return dots;
}
const n = (v) => String(Math.round(v * 100) / 100);
/** Dots as SVG circles, gathered by colour so the file stays small. */
export function circles(dots) {
    const byColor = new Map();
    for (const dot of dots)
        byColor.set(dot.color, [...(byColor.get(dot.color) ?? []), dot]);
    return [...byColor]
        .map(([color, same]) => `<g fill="${color}">${same.map((d) => `<circle cx="${n(d.x)}" cy="${n(d.y)}" r="${n(d.r)}"/>`).join('')}</g>`)
        .join('\n');
}
export function svg(width, height, body, note) {
    return (`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n` +
        `<!-- ${note} Drawn by packages/ui/drawing; not by hand. -->\n${body}\n</svg>\n`);
}
//# sourceMappingURL=matrix.js.map