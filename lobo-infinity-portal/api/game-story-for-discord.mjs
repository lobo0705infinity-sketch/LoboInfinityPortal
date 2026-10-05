// Bundle the shared report/story engine before deployment; Vercel traces this
// JavaScript artifact without relying on runtime TypeScript source files.
export { default, createGameStoryHandler } from './_lib/game-story-handler.mjs'
