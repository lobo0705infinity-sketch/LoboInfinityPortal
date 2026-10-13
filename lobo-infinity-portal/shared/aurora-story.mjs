// Public setting material from the definitive Player Guide, pages 7–9.
// Turn-specific releases and faction-only briefings remain in GM records.
export const AURORA_HISTORY = [
  {
    title: 'A world worth fighting for',
    body: `Aurora VII entered Human Sphere attention as a rare prize: a broadly habitable world with extensive mineral wealth, viable settlement zones, unusual native ecosystems, and enormous room for expansion. Governments, corporations, scientists, prospectors, and independent organizations arrived almost as soon as serious colonization became possible.

To prevent immediate conflict, O-12 brokered the Aurora Initiative. No single state received sovereignty. Recognized participants could establish settlements, research stations, and commercial operations while disputes were nominally subject to arbitration. Military forces were permitted for security and expedition protection. In practice, the difference between protecting an interest and controlling it quickly became difficult to define.`,
  },
  {
    title: 'The colony takes shape',
    body: `Pioneer's Landing in Nova Prospect became the colony's administrative and logistical center. Harmony City developed as O-12's diplomatic hub; Port Meridian became the principal maritime gateway; Greenwood Station grew into a center for biological research; Crystal Reach expanded around the extraordinary crystal fields; and Freeport Echo became the colony's most independent market for cargo, information, mercenary work, and less formal commerce.

The Human Sphere powers came for different reasons. PanOceania supplied major investment and infrastructure, while Yu Jing resisted any attempt to turn economic dominance into political control. Haqqislam pursued scientific access and knowledge. Nomad interests opposed efforts to centralize Aurora VII's information systems under structures too closely tied to ALEPH. JSA saw a chance to establish influence beyond Yu Jing's shadow. O-12 tried to preserve the colonial framework, while ALEPH increasingly became involved in the planet's most difficult scientific questions.`,
  },
  {
    title: 'The frontier and the outsiders',
    body: `Ariadna's involvement developed differently. Ariadnan settlers, prospectors, engineers, and expedition personnel were drawn to the frontier itself. Experience on Dawn made them unusually comfortable with remote communities, difficult logistics, and regions where sophisticated infrastructure could not always be relied upon. By the opening of the campaign, Ariadna has real communities and interests to protect across Aurora VII's less developed regions.

NA2 mercenary companies became an essential part of the colonial economy. Governments, corporations, researchers, and private interests all needed armed personnel without always wanting official forces attached to their operations. Contracts became increasingly lucrative as political competition intensified.

Tohaa and Combined Army forces are known to be active on Aurora VII by the opening of the campaign. What is not publicly understood is what either faction ultimately wants. Tohaa operations appear focused on shaping events rather than claiming colonial territory, while Combined Army activity emphasizes reconnaissance and operational footholds rather than conventional conquest.`,
  },
  {
    title: 'An uneasy peace. An unexplained Signal.',
    body: `By the time the campaign begins, the Aurora Initiative still exists on paper, but the peace it was designed to protect is increasingly artificial. Territorial disputes have become armed confrontations, intelligence operations are expanding, and every important discovery threatens to alter the balance of power. Into that environment comes the Signal — unexplained, increasingly difficult to ignore, and potentially important enough to turn a colonial rivalry into something far larger.`,
  },
]

// Narrative briefs expand the public motivations; no Turn-specific revelations.
export const AURORA_MOTIVATIONS = [
  {
    "faction": "PanOceania",
    "body": "Investment, infrastructure, colonial influence, and strategic dominance.",
    "brief": "PanOceania sees Aurora VII as a frontier whose wealth can become lasting strategic influence. Mineral deposits and promising settlements need transport, communications, and reliable security before they can sustain a growing colony. PanOceanian investment helps provide that foundation, but every new facility also raises a political question: who will set the terms under which everyone else uses it?\n\nIts forces have interests to protect and rivals determined to limit their reach. Holding a developed region means protecting the colony's economic machinery while strengthening PanOceania's claim to leadership. From the PanOceanian perspective, allowing its investments to become bargaining chips for another power would squander the very future those investments were meant to build."
  },
  {
    "faction": "Yu Jing",
    "body": "Prevent PanOceanian dominance and secure a major strategic position of its own.",
    "brief": "The State Empire sees opportunity in Aurora VII, but also a familiar danger: PanOceanian economic strength becoming political authority before anyone has formally agreed to it. A colony can remain neutral on paper while its essential infrastructure, trade routes, and security arrangements increasingly answer to one power. Yu Jing intends to prevent that outcome.\n\nIts presence is therefore both a challenge to PanOceania and a bid for an independent strategic position. Every foothold gives the State Empire greater leverage over the colony's future. Protecting access matters as much as denying a rival exclusive control, and territorial victories must become influence that survives the next round of negotiations."
  },
  {
    "faction": "Ariadna",
    "body": "Protect frontier communities and preserve access to the undeveloped regions its people helped settle.",
    "brief": "For Ariadna, Aurora VII is already more than a promising entry on somebody's survey chart. Settlers, prospectors, engineers, and expedition personnel have made lives in its less developed regions. Experience on Dawn has prepared them for difficult supply lines, remote communities, and places where advanced infrastructure cannot always be trusted to work when it is needed.\n\nThose communities give Ariadna something immediate to defend. A distant agreement matters little if a settlement loses access to supplies, or if another power decides that a familiar frontier route is now a military boundary. Ariadnan forces fight to keep those regions open to the people who helped settle them, and to ensure that the colony's future includes more than the priorities of its richest sponsors."
  },
  {
    "faction": "Haqqislam",
    "body": "Secure scientific access, knowledge, and discoveries of exceptional value.",
    "brief": "Haqqislam is drawn to the questions Aurora VII can answer. A habitable world with unusual native ecosystems and extraordinary resources offers opportunities for research that cannot be reduced to a mining concession. Knowledge gathered here may prove valuable far beyond the colony, provided researchers can reach it and continue their work without another faction deciding what they are allowed to study.\n\nIts military presence protects that access. Laboratories, expeditions, and routes through contested regions all become vulnerable as colonial competition turns violent. The Signal makes the scientific stakes harder to ignore, but it has not yet provided a clear explanation. Haqqislam's task is to preserve the freedom to investigate while preventing discoveries from becoming the exclusive property of whichever army arrives first."
  },
  {
    "faction": "Nomads",
    "body": "Protect independent networks, information freedom, and prevent monopolization by the Hyperpowers or ALEPH.",
    "brief": "The Nomads see a struggle over Aurora VII's information as well as its territory. Whoever controls communications and the systems on which colonial life depends can shape what people know, which claims they trust, and how freely independent communities can act. A developing world is especially vulnerable to arrangements that seem convenient until everyone discovers how difficult they are to leave.\n\nNomad interests oppose a future in which the Hyperpowers or ALEPH become the colony's unavoidable intermediaries. Their forces defend independent networks and the freedom to exchange information beyond those structures. As disputes intensify, keeping that independence means contesting the places and relationships through which other powers extend their influence. The unexplained Signal adds another question to an already crowded struggle over who gets to interpret the truth."
  },
  {
    "faction": "JSA",
    "body": "Build independent influence and prevent Aurora VII from becoming another arena dominated by Yu Jing or PanOceania.",
    "brief": "Aurora VII offers JSA a chance to establish influence on ground whose political future is still unsettled. The danger is that this opportunity will close before it can be used: a colonial framework shared by many participants can still become an arena in which PanOceania and Yu Jing make the decisive choices while everyone else adjusts to the consequences.\n\nJSA intends to secure a position from which it can act in its own right. Territorial access, a credible military presence, and victories that other factions must acknowledge all contribute to that independence. Its forces are not merely seeking a place in someone else's colonial plan. They are fighting to ensure that JSA has a voice in what Aurora VII becomes, and the leverage to make that voice count."
  },
  {
    "faction": "O-12",
    "body": "Preserve order, keep the colonial framework functioning, and prevent the crisis from becoming open war.",
    "brief": "O-12 helped create the Aurora Initiative so that rival interests could share the colony without immediately fighting over sovereignty. The framework permits settlements, research, commerce, and armed protection while leaving disputes subject to arbitration. It depends on participants accepting limits even when they believe they could obtain more by force.\n\nThat restraint is becoming harder to maintain. Territorial disputes have already produced armed confrontations, and every new discovery threatens to change the balance of power. O-12's forces must protect the possibility of a functioning colonial order while operating among factions increasingly willing to settle arguments on the battlefield. Their challenge is to stop the crisis becoming an unrestricted war without allowing the Initiative to become little more than a legal cover for the strongest participant."
  },
  {
    "faction": "ALEPH",
    "body": "Understand the Signal, manage systemic risk, and prevent a discovery of unknown significance from destabilizing the Human Sphere.",
    "brief": "Aurora VII presents ALEPH with problems that reach beyond the colony's political disputes. Its scientific questions are becoming more difficult, and the Signal is an unexplained phenomenon that no responsible analysis can simply dismiss. Understanding it requires information, access, and the ability to distinguish reliable observations from claims shaped by factional interests.\n\nALEPH's involvement is therefore both investigative and strategic. Competition can obstruct research precisely when cooperation would make it more useful, while a discovery of unknown significance could produce consequences far beyond Aurora VII. Its forces seek the conditions under which the phenomenon can be studied and risks assessed. Other participants may distrust that involvement, especially where it intersects with the colony's information systems, making the pursuit of understanding another contested part of the conflict."
  },
  {
    "faction": "NA2",
    "body": "Profit from the conflict by becoming the indispensable military contractors of Aurora VII.",
    "brief": "Aurora VII's colonial economy has made mercenary companies essential. Governments, corporations, researchers, and private interests need armed protection, but they do not always want official forces attached to their operations. NA2 supplies the personnel who can guard an expedition, secure a route, or fight for a position while the employer keeps its own political footprint smaller.\n\nAs competition becomes conflict, those services become more valuable. NA2's success depends on being the contractor a client cannot afford to do without: capable enough to deliver, and useful enough to be hired again. Its companies fight for the rewards and influence earned through contracts rather than a conventional colonial empire. For their commanders, Aurora VII is a war in which proving what their force can accomplish is itself a strategic asset."
  },
  {
    "faction": "Tohaa",
    "body": "Manipulate outcomes rather than rule territory; their deeper concern remains unclear to most participants.",
    "brief": "The Tohaa are known to be present on Aurora VII, but their involvement does not resemble a straightforward bid for colonial territory. Their operations appear directed toward shaping outcomes: influencing which powers advance, which positions endure, and how the balance between competing factions develops. That makes their presence difficult for other participants to interpret.\n\nA faction may benefit from a change in the balance without understanding why the Tohaa helped produce it. Another may see its ambitions frustrated without finding an alien occupation force to fight. Public knowledge establishes the pattern of intervention, not the deeper purpose behind it. For commanders trying to understand Aurora VII, the Tohaa remain a power whose actions matter even when the reason for those actions is still uncertain."
  },
  {
    "faction": "Combined Army",
    "body": "Establish footholds and investigate Aurora VII; the EI's true interest in the planet is not yet understood.",
    "brief": "Combined Army forces are openly known to be operating on Aurora VII. Their activity emphasizes reconnaissance and operational footholds rather than the territorial claims through which the Human Sphere powers seek to control the colony. An alien presence in a contested region is therefore not necessarily an attempt to become its conventional ruler, but it cannot safely be treated as a passing intrusion either.\n\nA foothold gives those forces a position from which to observe and continue operating while the colonial powers compete with one another. What the EI ultimately wants from Aurora VII remains unknown to the other participants. That uncertainty gives each encounter a wider significance: a battle may reveal where the Combined Army is active without revealing what it considers important, or how the colony fits into its larger intentions."
  }
]
