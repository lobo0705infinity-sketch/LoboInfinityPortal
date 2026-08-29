export type EventResultTimelineItem = {
  body: string
  timestamp: string
  title: string
  type: string
}

export function getEventResultTimelineItems(
  timeline: EventResultTimelineItem[],
) {
  return timeline.filter((item) => item.type === 'Result')
}
