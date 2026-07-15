delete process.env.VISUAL_COMPARE_BASELINES
delete process.env.UPDATE_VISUAL_BASELINES

await import('./capture-release-visual-candidates.mjs')
