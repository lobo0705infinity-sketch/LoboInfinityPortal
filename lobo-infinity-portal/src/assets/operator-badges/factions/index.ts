// Operator Badge Faction Registry
// Operation Facelift 2.5
// Version 1.0

// ===== ALEPH =====

import Aleph from "./aleph.svg";
import OperationsSubsection from "./operations-subsection.svg";
import SteelPhalanx from "./steel-phalanx.svg";

// ===== PanOceania =====

import PanOceania from "./panoceania.svg";
import MilitaryOrders from "./military-orders.svg";
import Neoterra from "./neoterra.svg";
import Varuna from "./varuna.svg";
import WinterFor from "./winterfor.svg";
import ShockArmy from "./shock-army.svg";
import Kestrel from "./kestrel-colonial-force.svg";

// ===== Yu Jing =====

import YuJing from "./yu-jing.svg";
import ImperialService from "./imperial-service.svg";
import InvincibleArmy from "./invincible-army.svg";
import WhiteBanner from "./white-banner.svg";

// ===== Ariadna =====

import Ariadna from "./ariadna.svg";
import Caledonia from "./caledonian-highlander-army.svg";
import Tartary from "./tartary-army-corps.svg";
import USAriadna from "./usariadna-ranger-force.svg";
import Kosmoflot from "./kosmoflot.svg";

// ===== Haqqislam =====

import Haqqislam from "./haqqislam.svg";
import HassassinBahram from "./hassassin-bahram.svg";
import RamahTaskforce from "./ramah-taskforce.svg";
import QapuKhalqi from "./qapu-khalqi.svg";

// ===== Nomads =====

import Nomads from "./nomads.svg";
import Corregidor from "./corregidor.svg";
import Bakunin from "./bakunin.svg";
import Tunguska from "./tunguska.svg";

// ===== Combined Army =====

import CombinedArmy from "./combined-army.svg";
import Morats from "./morat-aggression-force.svg";
import Shasvastii from "./shasvastii-expeditionary-force.svg";
import Onyx from "./onyx-contact-force.svg";
import NextWave from "./next-wave.svg";

// ===== O-12 =====

import O12 from "./o-12.svg";
import Starmada from "./starmada.svg";

// ===== JSA =====

import JapaneseSecessionistArmy from "./japanese-secessionist-army.svg";
import Shindenbutai from "./shindenbutai.svg";
import Oban from "./oban.svg";

// ===== NA2 =====

import Druze from "./druze-bayram-security.svg";
import Ikari from "./ikari-company.svg";
import Dashat from "./dashat-company.svg";
import WhiteCompany from "./white-company.svg";
import TorchlightBrigade from "./torchlight-brigade.svg";

// ===== Neutral =====

import LoboDefault from "./lobo-default.svg";

export const factionIcons: Record<string, string> = {
  // ALEPH
  "ALEPH": Aleph,
  "Aleph": Aleph,
  "Operations Subsection": OperationsSubsection,
  "Operations Subsection of the SSS": OperationsSubsection,
  "Steel Phalanx": SteelPhalanx,

  // PanO
  "PanOceania": PanOceania,
  "Military Orders": MilitaryOrders,
  "NeoTerra": Neoterra,
  "Neoterran Capitaline Army": Neoterra,
  "Varuna": Varuna,
  "Varuna Immediate Reaction Division": Varuna,
  "WinterFor": WinterFor,
  "Svalarheima's Winter Force": WinterFor,
  "Svalarheima’s Winter Force": WinterFor,
  "Shock Army": ShockArmy,
  "Shock Army of Acontecimento": ShockArmy,
  "Kestrel": Kestrel,
  "Kestrel Colonial Force": Kestrel,

  // Yu Jing
  "Yu Jing": YuJing,
  "Imperial Service": ImperialService,
  "Invincible Army": InvincibleArmy,
  "White Banner": WhiteBanner,

  // Ariadna
  "Ariadna": Ariadna,
  "Caledonian Highlander Army": Caledonia,
  "Tartary Army Corps": Tartary,
  "USAriadna Ranger Force": USAriadna,
  "Kosmoflot": Kosmoflot,

  // Haqqislam
  "Haqqislam": Haqqislam,
  "Hassassin Bahram": HassassinBahram,
  "Ramah Taskforce": RamahTaskforce,
  "Qapu Khalqi": QapuKhalqi,

  // Nomads
  "Nomads": Nomads,
  "Corregidor": Corregidor,
  "Jurisdictional Command of Corregidor": Corregidor,
  "Corregidor Jurisdictional Command": Corregidor,
  "Bakunin": Bakunin,
  "Jurisdictional Command of Bakunin": Bakunin,
  "Bakunin Jurisdictional Command": Bakunin,
  "Tunguska": Tunguska,
  "Jurisdictional Command of Tunguska": Tunguska,
  "Tunguska Jurisdictional Command": Tunguska,

  // Combined Army
  "Combined Army": CombinedArmy,
  "Morat Aggression Force": Morats,
  "Morat Aggression Forces": Morats,
  "Shasvastii Expeditionary Force": Shasvastii,
  "Onyx Contact Force": Onyx,
  "Next Wave": NextWave,

  // O-12
  "O-12": O12,
  "Starmada": Starmada,

  // JSA
  "JSA": JapaneseSecessionistArmy,
  "Japanese Secessionist Army": JapaneseSecessionistArmy,
  "Shindenbutai": Shindenbutai,
  "Oban": Oban,
  "Ōban": Oban,

  // NA2
  "Druze Bayram Security": Druze,
  "Ikari Company": Ikari,
  "Dashat Company": Dashat,
  "Dahshat Company": Dashat,
  "White Company": WhiteCompany,
  "Torchlight Brigade": TorchlightBrigade
};

export function getFactionIcon(preferredFaction?: string): string {
  if (!preferredFaction?.trim()) return LoboDefault;

  return factionIcons[preferredFaction] ?? LoboDefault;
}
