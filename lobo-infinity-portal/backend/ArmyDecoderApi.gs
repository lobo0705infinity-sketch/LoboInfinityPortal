/*******************************************************
 * LOBO INFINITY LEAGUE
 * ArmyDecoderApi.gs
 *
 * Shared production Infinity Army Code decoder.
 *******************************************************/

function testDecodeArmyCode() {

  const result = {
    success: false,
    status: "Retired",
    error:
      "Apps Script external Army decoding is retired. " +
      "Use the Vercel Army Intelligence refresh workflow."
  };

  Logger.log(JSON.stringify(result));

  return result;

}

function parseArmyCodeBinary(value) {

  const text =
    decodeURIComponent(String(value || ""))
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const bytes =
    Utilities.base64Decode(text);

  const parserTrace = [];
  let offset = 0;

  function readVli(label) {
    const startOffset =
      offset;

    if (offset >= bytes.length)
      throw new Error("Unexpected EOF at byte " + offset + ".");

    const value =
      bytes[offset] > 127
        ? bytes[offset] - 256
        : bytes[offset];

    if (value < 0) {
      if (offset + 1 >= bytes.length)
        throw new Error("Unexpected EOF in extended token at byte " + offset + ".");

      const result =
        (((bytes[offset] & 255) << 8) | (bytes[offset + 1] & 255)) & ~(1 << 15);

      offset += 2;
      parserTrace.push(buildArmyDecoderTrace(label, startOffset, offset, result));
      return result;
    }

    offset += 1;
    parserTrace.push(buildArmyDecoderTrace(label, startOffset, offset, value));
    return value;
  }

  function readString(label) {
    const length =
      readVli(label + ".length");

    const startOffset =
      offset;

    if (offset + length > bytes.length)
      throw new Error("Unexpected EOF while reading string at byte " + offset + ".");

    const value =
      Utilities
        .newBlob(bytes.slice(offset, offset + length))
        .getDataAsString();

    offset += length;
    parserTrace.push(buildArmyDecoderTrace(label, startOffset, offset, value));
    return value;
  }

  const sectorialId =
    readVli("sectorialId");

  const sectorialSlug =
    readString("sectorialSlug");

  if (offset >= bytes.length)
    throw new Error("Unexpected EOF before army name.");

  const armyNameLength =
    bytes[offset] & 255;

  parserTrace.push(buildArmyDecoderTrace("armyName.length", offset, offset + 1, armyNameLength));
  offset += 1;

  if (offset + armyNameLength > bytes.length)
    throw new Error("Unexpected EOF while reading army name.");

  const listName =
    Utilities
      .newBlob(bytes.slice(offset, offset + armyNameLength))
      .getDataAsString();

  parserTrace.push(buildArmyDecoderTrace("armyName", offset, offset + armyNameLength, listName));
  offset += armyNameLength;

  const maxPoints =
    readVli("maxPoints");

  const combatGroupCount =
    readVli("combatGroupCount");

  const combatGroups = [];

  for (let index = 0; index < combatGroupCount; index++) {
    const combatGroupId =
      readVli("combatGroup." + (index + 1) + ".id");

    const versionSwitch =
      readVli("combatGroup." + (index + 1) + ".versionSwitch");

    const reinforcement =
      versionSwitch === 1
        ? readVli("combatGroup." + (index + 1) + ".reinforcement")
        : null;

    const size =
      readVli("combatGroup." + (index + 1) + ".size");

    const fillerZero =
      versionSwitch === 1
        ? readVli("combatGroup." + (index + 1) + ".fillerZero")
        : null;

    const members = [];

    for (let memberIndex = 0; memberIndex < size; memberIndex++) {
      if (versionSwitch === 0)
        readVli("combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".legacySlot");

      const unitId =
        readVli("combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".unitId");

      const groupId =
        readVli("combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".groupId");

      const optionId =
        readVli("combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".optionId");

      if (offset >= bytes.length)
        throw new Error("Unexpected EOF before profile terminator.");

      const trailingZero =
        bytes[offset] & 255;

      parserTrace.push(buildArmyDecoderTrace(
        "combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".terminator",
        offset,
        offset + 1,
        trailingZero
      ));
      offset += 1;

      members.push({
        combinedId: sectorialId + "-" + unitId + "-" + groupId + "-" + optionId + "-1",
        combatGroup: index + 1,
        groupId: groupId,
        optionId: optionId,
        trailingZero: trailingZero,
        unitId: unitId
      });

      if (memberIndex < size - 1 && versionSwitch === 1)
        readVli("combatGroup." + (index + 1) + ".member." + (memberIndex + 1) + ".separator");
    }

    combatGroups.push({
      combatGroup: index + 1,
      combatGroupId: combatGroupId,
      fillerZero: fillerZero,
      members: members,
      reinforcement: reinforcement,
      versionSwitch: versionSwitch
    });
  }

  if (offset !== bytes.length)
    throw new Error("Army code decode ended at byte " + offset + ", expected " + bytes.length + ".");

  return {
    byteLength: bytes.length,
    combatGroupCount: combatGroupCount,
    combatGroups: combatGroups,
    listName: listName,
    maxPoints: maxPoints,
    parserTrace: parserTrace,
    sectorialId: sectorialId,
    sectorialSlug: sectorialSlug
  };

}

function resolveArmyCodeProfiles(armyCode) {

  const result = {
    armyName: "",
    combatGroups: 0,
    faction: "",
    parserWarnings: [],
    points: 0,
    roster: [],
    sectorial: "",
    swc: 0
  };

  result.parserWarnings.push(
    "External profile decoding is retired in Apps Script; use the Vercel Army Intelligence worker."
  );

  return result;

}

function findArmyDecoderProfileCard(profileCards, startIndex, profile) {

  const normalizedProfile =
    normalizeArmyDecoderProfileCardName(profile && profile.decodedProfile);

  for (let index = startIndex; index < profileCards.length; index += 1) {
    const normalizedCard =
      normalizeArmyDecoderProfileCardName(profileCards[index] && profileCards[index].unit);

    if (normalizedCard && normalizedCard === normalizedProfile)
      return {
        card: profileCards[index],
        nextIndex: index + 1
      };
  }

  return {
    card: profileCards[startIndex],
    nextIndex: startIndex + 1
  };

}

function normalizeArmyDecoderProfileCardName(value) {

  return getArmyDecoderString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

function parseArmyDecoderProfileCards(body) {

  const cards = [];
  const cardPattern =
    /<div class="card"\s+data-info="combinedId:[^"]*">([\s\S]*?)(?=<div class="card"\s+data-info="combinedId:|<div class="army-group-title">|<div class="army-list-footer">|$)/g;

  let cardMatch =
    cardPattern.exec(body);

  while (cardMatch) {
    cards.push(parseArmyDecoderProfileCard(cardMatch[0]));
    cardMatch =
      cardPattern.exec(body);
  }

  return cards;

}

function parseArmyDecoderProfileCard(cardHtml) {

  const unit =
    textContent(matchArmyDecoderFirst(cardHtml, /<h2 class="card-header-title">([\s\S]*?)<\/h2>/));

  const troopType =
    textContent(matchArmyDecoderFirst(cardHtml, /<div class="typ-and-category">\s*<div>([\s\S]*?)<\/div>/));

  const equipment =
    splitArmyDecoderProfileTokens(textContent(matchArmyDecoderFirst(cardHtml, /<b>\s*Equipment:\s*<\/b>\s*<span>([\s\S]*?)<\/span>/i)));

  const skills =
    splitArmyDecoderProfileTokens(textContent(matchArmyDecoderFirst(cardHtml, /<b>\s*Skills:\s*<\/b>\s*<span>([\s\S]*?)<\/span>/i)));

  const weapons = [];
  const weaponPattern =
    /<td class="weapon-table-name-header">([\s\S]*?)<\/td>/g;

  let weaponMatch =
    weaponPattern.exec(cardHtml);

  while (weaponMatch) {
    const weapon =
      textContent(weaponMatch[1]);

    if (weapon)
      weapons.push(weapon);

    weaponMatch =
      weaponPattern.exec(cardHtml);
  }

  const metadataText =
    [unit]
      .concat(equipment)
      .concat(skills)
      .concat(weapons)
      .join(" ");

  return {
    chainOfCommand: /chain\s+of\s+command/i.test(metadataText),
    doctor: /\bdoctor\b/i.test(metadataText),
    engineer: /\bengineer\b/i.test(metadataText),
    equipment: equipment,
    forwardObserver: /forward\s+observer/i.test(metadataText),
    hacker: hasArmyDecoderProfileSkill(skills, /\bhacker\b/i),
    lieutenant: /\blieutenant\b/i.test(metadataText),
    skills: skills,
    specialist: /chain\s+of\s+command|\bdoctor\b|\bengineer\b|forward\s+observer|\bhacker\b|hacking\s+device|\bparamedic\b/i.test(metadataText),
    troopType: troopType,
    unit: unit,
    weapons: weapons
  };

}

function mergeArmyDecoderProfileCard(profile, card) {

  const metadata =
    card || {};

  return {
    combatGroup: profile.combatGroup,
    chainOfCommand: Boolean(metadata.chainOfCommand),
    decodedProfile: profile.decodedProfile,
    doctor: Boolean(metadata.doctor),
    engineer: Boolean(metadata.engineer),
    equipment: metadata.equipment || [],
    forwardObserver: Boolean(metadata.forwardObserver),
    hacker: Boolean(metadata.hacker),
    lieutenant: Boolean(metadata.lieutenant),
    points: profile.points,
    rawProfile: profile.rawProfile,
    skills: metadata.skills || [],
    specialist: Boolean(metadata.specialist),
    swc: profile.swc,
    troopType: metadata.troopType || "",
    unit: metadata.unit || profile.decodedProfile,
    weapons: metadata.weapons || []
  };

}

function splitArmyDecoderProfileTokens(value) {

  return getArmyDecoderString(value)
    .split(/\s*,\s*/)
    .map(function(token) {
      return token.trim();
    })
    .filter(Boolean);

}

function hasArmyDecoderProfileSkill(skills, pattern) {

  return splitArmyDecoderProfileTokens(skills).some(function(skill) {
    return pattern.test(skill);
  });

}

function parseArmyDecoderRows(groupHtml, combatGroup) {

  const rows = [];
  const rowPattern =
    /<div class="army-list-row">([\s\S]*?)(?=<div class="army-list-row">|$)/g;

  let rowMatch =
    rowPattern.exec(groupHtml);

  while (rowMatch) {
    const rowHtml =
      rowMatch[1];

    const costText =
      textContent(matchArmyDecoderFirst(rowHtml, /<div>\s*([^<]*(?:SWC|pts?)[^<]*)<\/div>/i));

    const cost =
      parseArmyDecoderCost(costText);

    const decodedProfile =
      sanitizeArmyDecoderProfileText(
        textContent(rowHtml)
        .replace(costText, "")
      )
        .replace(/\s+/g, " ")
        .trim();

    rows.push({
      combatGroup: combatGroup || 1,
      decodedProfile: decodedProfile || "Unknown Profile",
      points: cost.points,
      rawProfile: rowHtml,
      swc: cost.swc
    });

    rowMatch =
      rowPattern.exec(groupHtml);
  }

  return rows;

}

function sanitizeArmyDecoderProfileText(value) {

  return getArmyDecoderString(value)
    .replace(/\s+Army Code:\s+\S+[\s\S]*$/i, "");

}

function buildArmyDecoderBinaryRoster(binary) {

  const roster = [];

  binary.combatGroups.forEach(function(group) {
    group.members.forEach(function(member) {
      roster.push({
        combatGroup: group.combatGroup,
        decodedProfile: member.combinedId,
        points: 0,
        rawProfile: JSON.stringify(member),
        swc: 0
      });
    });
  });

  return roster;

}

function parseArmyDecoderCost(text) {

  const normalized =
    getArmyDecoderString(text);

  const pointsMatch =
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:pts?|points?)/i);

  const swcMatch =
    normalized.match(/(\d+(?:\.\d+)?)\s*SWC/i);

  return {
    points:
      pointsMatch
        ? Number(pointsMatch[1]) || 0
        : 0,
    swc:
      swcMatch
        ? Number(swcMatch[1]) || 0
        : 0
  };

}

function buildArmyDecoderTrace(label, startOffset, endOffset, value) {

  return {
    endOffset: endOffset,
    label: label,
    parserState: label,
    startOffset: startOffset,
    token: String(value)
  };

}

function extractArmyCodePayload(value) {

  const text =
    String(value || "").trim();

  if (!text)
    return "";

  const match =
    text.match(/(?:list|army|code)[\/=]([A-Za-z0-9+/_=-]+)/i);

  if (match)
    return decodeArmyCodePayload(match[1]);

  const tail =
    text.split(/[?#&/]/).filter(Boolean).pop() || text;

  return decodeArmyCodePayload(tail);

}

function decodeArmyCodePayload(value) {

  const compact =
    String(value || "").replace(/\s+/g, "");

  try {
    return decodeURIComponent(compact);
  }
  catch (err) {
    return compact;
  }

}

function inspectArmyCodeEncoding(value) {

  const code =
    String(value || "");

  if (!code)
    return {
      decodedText: "",
      looksLikeJsonEnd: false,
      looksLikeJsonStart: false,
      reason: "No encoded Army Code payload was found.",
      valid: false
    };

  const normalized =
    code.replace(/-/g, "+").replace(/_/g, "/");

  if (!/^[A-Za-z0-9+/=]+$/.test(normalized))
    return {
      decodedText: "",
      looksLikeJsonEnd: false,
      looksLikeJsonStart: false,
      reason: "Encoded payload is not base64/base64url-safe.",
      valid: false
    };

  try {
    const padded =
      normalized + "===".slice((normalized.length + 3) % 4);

    const decoded =
      Utilities.newBlob(
        Utilities.base64Decode(padded)
      ).getDataAsString();

    return {
      decodedText: decoded,
      looksLikeJsonEnd: /[\]}]\s*$/.test(decoded),
      looksLikeJsonStart: /^\s*[\[{]/.test(decoded),
      reason: decoded.length > 0 ? "" : "Base64 payload decoded to an empty string.",
      valid: decoded.length > 0
    };
  }
  catch (err) {
    return {
      decodedText: "",
      looksLikeJsonEnd: false,
      looksLikeJsonStart: false,
      reason: "Base64 decode failed: " + String(err),
      valid: false
    };
  }

}

function hasRepeatedArmyCodeEncoding(value) {

  if (!value || value.length < 32 || value.length % 2 !== 0)
    return false;

  const half =
    value.length / 2;

  return value.slice(0, half) === value.slice(half);

}

function hasInfinityArmyCodePrefix(value) {

  return /^https?:\/\/(?:www\.)?(?:infinitytheuniverse\.com|army\.infinitytheuniverse\.com)\//i.test(value);

}

function getArmyDecoderParentFaction(sectorial) {

  if (typeof canonicalizeArmyParentFaction === "function")
    return canonicalizeArmyParentFaction(sectorial) || sectorial;

  return sectorial;

}

function normalizeArmyDecoderName(value) {

  return getArmyDecoderString(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, function(letter) {
      return letter.toUpperCase();
    });

}

function matchArmyDecoderFirst(value, pattern) {

  const match =
    String(value || "").match(pattern);

  return match
    ? match[1]
    : "";

}

function textContent(value) {

  return getArmyDecoderString(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

}

function getArmyDecoderString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}
