// Public player and territory guides only. No GM-only story or objective tables.
export const AURORA_TERRITORIES = Object.freeze([
  {
    "id": "nova-prospect",
    "name": "Nova Prospect",
    "settlement": "Pioneer’s Landing",
    "vp": 3,
    "description": "Colonial capital and orbital logistics. Permanent civic buildings, communications, and developed streets.",
    "layouts": [
      "Administrative District",
      "Orbital Logistics District"
    ],
    "notes": [
      "Use substantial civic buildings to break streets and sightlines.",
      "Keep warehouses and freight routes broad enough for TAGs.",
      "Cargo and vehicles supplement buildings rather than replacing them."
    ],
    "x": 0.59,
    "y": 0.77,
    "number": 1
  },
  {
    "id": "korin-range",
    "name": "Korin Range",
    "settlement": "Dragon Gate Enclave",
    "vp": 3,
    "description": "A mountain research region defined by cliffs, ridges, bridges, and high passes.",
    "layouts": [
      "Research Valley",
      "High Pass"
    ],
    "notes": [
      "Integrate irregular research structures into natural terrain.",
      "Provide several approaches through, under, or around ridges.",
      "A bridge or pass must never be the only route."
    ],
    "x": 0.465,
    "y": 0.4,
    "number": 2
  },
  {
    "id": "crystal-frontier",
    "name": "Crystal Frontier",
    "settlement": "Crystal Reach",
    "vp": 3,
    "description": "A mineral frontier of fractured quarry terraces, blue-grey crystal ravines, extraction works, and scattered research facilities.",
    "layouts": [
      "Faultline Works",
      "Rift Research Station"
    ],
    "notes": [
      "Use substantial quarry faces, workshops, laboratories, and crystal-bearing rock as Line of Fire blockers.",
      "Keep the diagonal ravine ends inside the board, with several clear bridge crossings and routes around its ends.",
      "Preserve protected approaches, broad access cuts, and usable midfield objective space."
    ],
    "x": 0.69,
    "y": 0.19,
    "number": 3
  },
  {
    "id": "echo-shores",
    "name": "Echo Shores",
    "settlement": "Freeport Echo",
    "vp": 2,
    "description": "An improvised coastal trade zone of docks, cranes, warehouses, markets, and independent commerce.",
    "layouts": [
      "Dockside Operations",
      "Freeport Echo Market District"
    ],
    "notes": [
      "Water shapes the table without consuming most playable ground.",
      "Provide multiple dock crossings and interconnected market passages.",
      "Stalls, awnings, and cargo provide texture; major structures control sightlines."
    ],
    "x": 0.765,
    "y": 0.5,
    "number": 4
  },
  {
    "id": "harmony-province",
    "name": "Harmony Province",
    "settlement": "Harmony City",
    "vp": 2,
    "description": "An ordered civic center with planned public spaces, government architecture, and O-12 security infrastructure.",
    "layouts": [
      "Government Plaza",
      "O-12 Security District"
    ],
    "notes": [
      "Preserve meaningful open civic space.",
      "Use monuments, planters, and offset structures for staged cover.",
      "Distribute specialized institutions instead of building one giant headquarters."
    ],
    "x": 0.635,
    "y": 0.445,
    "number": 5
  },
  {
    "id": "verde-wilds",
    "name": "Verde Wilds",
    "settlement": "Greenwood Station",
    "vp": 2,
    "description": "Equatorial wilderness where research outposts and expedition routes are swallowed by jungle and waterways.",
    "layouts": [
      "Greenwood Station Jungle Outpost",
      "Greenwood River Crossing"
    ],
    "notes": [
      "Natural jungle and rock masses dominate the table.",
      "Keep scientific buildings scattered and routes broad enough for large models.",
      "Use several river crossings and preserve the water-network identity."
    ],
    "x": 0.285,
    "y": 0.465,
    "number": 6
  },
  {
    "id": "azure-coast",
    "name": "Azure Coast",
    "settlement": "Port Meridian",
    "vp": 2,
    "description": "Modern maritime logistics: clean port infrastructure, customs, maintenance, and intermodal transport.",
    "layouts": [
      "Coastal Access",
      "Tidal Infrastructure"
    ],
    "notes": [
      "Retain the harbor edge while leaving ample playable land.",
      "Interrupt broad roads with customs buildings and cargo compounds.",
      "Keep inland terminal terrain focused on road logistics, distinct from Echo Shores."
    ],
    "x": 0.125,
    "y": 0.42,
    "number": 7
  },
  {
    "id": "ember-highlands",
    "name": "Ember Highlands",
    "settlement": "Red Mesa Settlement",
    "vp": 1,
    "description": "A volcanic highland frontier of dark red rock, monumental mesas, remote habitation, and geothermal activity.",
    "layouts": [
      "Red Mesa Settlement",
      "Geothermal Badlands"
    ],
    "notes": [
      "Geology dominates small settlement and utility buildings.",
      "Provide branching canyon routes around enormous mesas.",
      "Geothermal pipes remain broken and crossable."
    ],
    "x": 0.205,
    "y": 0.74,
    "number": 8
  },
  {
    "id": "sulfur-basin",
    "name": "Sulfur Basin",
    "settlement": "Helios Extraction Complex",
    "vp": 1,
    "description": "A chemically scarred industrial territory ranging from dense refineries to exposed sulfur extraction fields.",
    "layouts": [
      "Helios Refinery",
      "Helios Extraction Fields"
    ],
    "notes": [
      "Distribute refinery masses rather than relying on one central complex.",
      "Keep pipe networks crossable with multiple TAG-capable routes.",
      "Extraction fields use substantial natural blockers with secondary machinery."
    ],
    "x": 0.42,
    "y": 0.72,
    "number": 9
  },
  {
    "id": "frostreach-wastes",
    "name": "Frostreach Wastes",
    "settlement": "Frosthold",
    "vp": 1,
    "description": "A polar frontier of glaciers, snowfields, survival installations, and isolated expedition sites.",
    "layouts": [
      "Frosthold Wastes",
      "Polar Expedition Zone"
    ],
    "notes": [
      "Large ice and rock masses provide primary Line of Fire blocking.",
      "Keep survival infrastructure compact and subordinate to the frozen landscape.",
      "Open expedition terrain still needs protected, tactically crossable approaches."
    ],
    "x": 0.465,
    "y": 0.115,
    "number": 10
  },
  {
    "id": "northward-expanse",
    "name": "Northward Expanse",
    "settlement": "New Al-Medina",
    "vp": 1,
    "description": "A dry scientific frontier, from permanent research networks to temporary camps at the edge of mapped territory.",
    "layouts": [
      "New Al-Medina Research Network",
      "Northern Survey Frontier"
    ],
    "notes": [
      "Natural ridges and outcrops form the principal battlefield terrain.",
      "Use distinct research functions rather than repeated prefab buildings.",
      "Northern survey terrain is more isolated, with minimal temporary infrastructure."
    ],
    "x": 0.275,
    "y": 0.215,
    "number": 11
  },
  {
    "id": "iron-corridor",
    "name": "Iron Corridor",
    "settlement": "Iron Junction",
    "vp": 1,
    "description": "A heavy rail region of freight switching, cargo transfer, inspection, maintenance, and transit services.",
    "layouts": [
      "Iron Junction Freight Yard",
      "Transit & Maintenance Hub"
    ],
    "notes": [
      "Rail lines weave through terrain with many broad crossings.",
      "Distributed facilities and freight buildings provide substantial cover.",
      "Avoid a giant central terminal or rail barrier dividing the table."
    ],
    "x": 0.57,
    "y": 0.235,
    "number": 12
  }
]);
export const AURORA_TURNS = Object.freeze([
  {
    "turn": 1,
    "title": "First Landing",
    "missions": [
      {
        "name": "Claim the Frontier",
        "reference": "Frontline"
      },
      {
        "name": "Colonial Supremacy",
        "reference": "Supremacy"
      }
    ]
  },
  {
    "turn": 2,
    "title": "Resource Rush",
    "missions": [
      {
        "name": "The Resource Convoys",
        "reference": "Supplies"
      },
      {
        "name": "Excavation Rights",
        "reference": "Acquisition"
      }
    ]
  },
  {
    "turn": 3,
    "title": "Shadow War",
    "missions": [
      {
        "name": "Erase the Evidence",
        "reference": "Mindwipe"
      },
      {
        "name": "Covert Operations",
        "reference": "Countermeasures"
      }
    ]
  },
  {
    "turn": 4,
    "title": "Signals From Below",
    "missions": [
      {
        "name": "The Buried Chamber",
        "reference": "Panic Room"
      },
      {
        "name": "Signal Relay",
        "reference": "Power Pack"
      }
    ]
  },
  {
    "turn": 5,
    "title": "Open Conflict",
    "missions": [
      {
        "name": "Sabotage the Rival",
        "reference": "Looting and Sabotaging"
      },
      {
        "name": "Control the Approaches",
        "reference": "Quadrant Control"
      }
    ]
  },
  {
    "turn": 6,
    "title": "Race for the Gate",
    "missions": [
      {
        "name": "Secure the Approach",
        "reference": "The Armory"
      },
      {
        "name": "The Korin Offensive",
        "reference": "Unmasking"
      }
    ]
  }
]);
export const AURORA_DOCTRINES = Object.freeze([
  {
    "faction": "PanOceania",
    "name": "Colonial Supremacy",
    "requirement": "Capture or successfully defend a 3 VP territory."
  },
  {
    "faction": "Yu Jing",
    "name": "Strategic Expansion",
    "requirement": "Capture a territory and lose no territory during the Turn."
  },
  {
    "faction": "Ariadna",
    "name": "Frontier Masters",
    "requirement": "Capture or successfully defend a 1 VP territory."
  },
  {
    "faction": "Haqqislam",
    "name": "Search for Knowledge",
    "requirement": "Capture or successfully defend a territory with a discovered Precursor Ruin. Before the first Ruin is discovered, use a 3 VP territory instead."
  },
  {
    "faction": "Nomads",
    "name": "Disrupt the Powers",
    "requirement": "Capture a territory from a faction that began the Turn tied for or controlling the most territories."
  },
  {
    "faction": "JSA",
    "name": "Rising Power",
    "requirement": "Capture a territory from a faction that began the Turn ahead of JSA in Campaign VP."
  },
  {
    "faction": "O-12",
    "name": "Balance of Power",
    "requirement": "Capture or successfully defend a Vulnerable Territory and end the Turn with the four Vulnerable Territories controlled by at least three different Conquest factions."
  },
  {
    "faction": "ALEPH",
    "name": "Strategic Analysis",
    "requirement": "Control a Vulnerable Territory tied for the highest combined territorial TP in the Turn. Narrative Mission TP is excluded."
  }
]);
export const AURORA_FACTIONS = Object.freeze(['PanOceania', 'Yu Jing', 'Ariadna', 'Haqqislam', 'Nomads', 'JSA', 'ALEPH', 'O-12', 'NA2', 'Tohaa', 'Combined Army']);
export const AURORA_CONQUEST_FACTIONS = Object.freeze(AURORA_FACTIONS.slice(0, 8));
