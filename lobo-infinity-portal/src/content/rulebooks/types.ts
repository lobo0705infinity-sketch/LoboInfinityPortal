export type RuleContent =
  | {
      text: string
      type: 'paragraph'
    }
  | {
      items: string[]
      type: 'ordered' | 'unordered'
    }
  | {
      children: RuleContent[]
      title: string
      type: 'subsection'
    }

export type RuleSection = {
  body: RuleContent[]
  id: string
  kicker?: string
  title: string
}

export type Rulebook = {
  description: string
  eventType: string
  id: string
  sections: RuleSection[]
  subtitle?: string
  title: string
}
