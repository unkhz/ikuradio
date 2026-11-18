export async function wait(delay) {
    const variance = Math.round(delay * 0.33);
    const naturalDelay = delay + (Math.round(variance * 2 * Math.random()) - variance);
    await new Promise((resolve) => setTimeout(resolve, naturalDelay));
}
//# sourceMappingURL=async.js.map