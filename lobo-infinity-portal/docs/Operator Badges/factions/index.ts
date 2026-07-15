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

import Neutral from "./neutral.svg";

export const factionIcons: Record<string, string> = {
  // ALEPH
  "ALEPH": Aleph,
  "Operations Subsection": OperationsSubsection,
  "Steel Phalanx": SteelPhalanx,

  // PanO
  "PanOceania": PanOceania,
  "Military Orders": MilitaryOrders,
  "NeoTerra": Neoterra,
  "Varuna": Varuna,
  "WinterFor": WinterFor,
  "Shock Army": ShockArmy,
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
  "Bakunin": Bakunin,
  "Tunguska": Tunguska,

  // Combined Army
  "Combined Army": CombinedArmy,
  "Morat Aggression Force": Morats,
  "Shasvastii Expeditionary Force": Shasvastii,
  "Onyx Contact Force": Onyx,
  "Next Wave": NextWave,

  // O-12
  "O-12": O12,
  "Starmada": Starmada,

  // JSA
  "Japanese Secessionist Army": JapaneseSecessionistArmy,
  "Shindenbutai": Shindenbutai,
  "Oban": Oban,

  // NA2
  "Druze Bayram Security": Druze,
  "Ikari Company": Ikari,
  "Dashat Company": Dashat,
  "White Company": WhiteCompany,
  "Torchlight Brigade": TorchlightBrigade
};

export function getFactionIcon(preferredFaction?: string): string {
  if (!preferredFaction) return Neutral;

  return factionIcons[preferredFaction] ?? Neutral;
}