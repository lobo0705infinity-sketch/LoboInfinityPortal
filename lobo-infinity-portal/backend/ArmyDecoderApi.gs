/*******************************************************
 * LOBO INFINITY LEAGUE
 * ArmyDecoderApi.gs
 *
 * Shared production Infinity Army Code decoder.
 *******************************************************/

const ARMY_DECODER_VERSION = "army-decoder-v1";

function decodeArmyCode(value) {

  const raw =
    getArmyDecoderString(value);

  const extracted =
    extractArmyCodePayload(raw);

  const validation =
    inspectArmyCodeEncoding(extracted);

  const result =
    buildArmyDecodeEmptyResult(raw, extracted, validation);

  if (!extracted) {
    result.parserWarnings.push("Army Code is empty.");
    result.exceptions.push("empty");
    result.parserFailure = buildArmyDecoderParserFailure(
      "input",
      "Army Code is empty.",
      "unexpected EOF"
    );
    Logger.log(
      JSON.stringify({
        returnStatement: "return normalizeArmyDecodeResult(result) after !extracted",
        condition: "!extracted",
        conditionResult: !extracted,
        variables: {
          extracted: extracted
        }
      })
    );
    return normalizeArmyDecodeResult(result);
  }

  if (!validation.valid) {
    result.parserWarnings.push(validation.reason);
    result.exceptions.push(validation.reason);
    result.parserFailure = buildArmyDecoderParserFailure(
      "encoding",
      validation.reason,
      "bad token"
    );
    Logger.log(
      JSON.stringify({
        returnStatement: "return normalizeArmyDecodeResult(result) after !validation.valid",
        condition: "!validation.valid",
        conditionResult: !validation.valid,
        variables: {
          validationValid: validation.valid
        }
      })
    );
    return normalizeArmyDecodeResult(result);
  }

  try {
    const binary =
      parseArmyCodeBinary(extracted);

    result.armyName =
      binary.listName;
    result.combatGroups =
      binary.combatGroupCount;
    result.sectorial =
      normalizeArmyDecoderName(binary.sectorialSlug);
    result.faction =
      getArmyDecoderParentFaction(result.sectorial);
    result.roster =
      buildArmyDecoderBinaryRoster(binary);
    result.parserTrace =
      binary.parserTrace;

    const resolved =
      resolveArmyCodeProfiles(extracted);

    result.parserWarnings =
      result.parserWarnings.concat(resolved.parserWarnings);

    if (resolved.roster.length > 0)
      result.roster =
        resolved.roster;

    result.points =
      resolved.points;
    result.swc =
      resolved.swc;

    if (resolved.combatGroups > 0)
      result.combatGroups =
        resolved.combatGroups;

    if (resolved.sectorial)
      result.sectorial =
        resolved.sectorial;

    if (resolved.faction)
      result.faction =
        resolved.faction;

    if (resolved.armyName)
      result.armyName =
        resolved.armyName;

    result.unitCount =
      result.roster.length;
    result.valid =
      true;

    return normalizeArmyDecodeResult(result);
  }
  catch (err) {
    result.parserWarnings.push("Decoder exception: " + String(err));
    result.exceptions.push(String(err));
    result.parserFailure = buildArmyDecoderParserFailure(
      "decodeArmyCode",
      String(err),
      getArmyDecoderFailureReason(String(err))
    );
    Logger.log(
      JSON.stringify({
        returnStatement: "return normalizeArmyDecodeResult(result) from catch (err)",
        condition: "catch (err)",
        conditionResult: true,
        variables: {
          error: String(err)
        }
      })
    );
    return normalizeArmyDecodeResult(result);
  }

}

function buildArmyDecodeEmptyResult(raw, extracted, validation) {

  return {
    armyName: "",
    combatGroups: 0,
    decoderVersion: ARMY_DECODER_VERSION,
    derived: {},
    exceptions: [],
    extractedCode: extracted,
    extractedLength: extracted.length,
    faction: "",
    parserFailure: null,
    parserTrace: [],
    parserWarnings: [],
    points: 0,
    rawLength: raw.length,
    roster: [],
    sectorial: "",
    swc: 0,
    unitCount: 0,
    validation: validation,
    valid: false
  };

}

function normalizeArmyDecodeResult(result) {

  result.derived = {
    armyName: result.armyName,
    combatGroups: result.combatGroups,
    faction: result.faction,
    points: result.points,
    sectorial: result.sectorial,
    swc: result.swc,
    unitCount: result.unitCount
  };

  result.decoder =
    result.decoderVersion;

  result.warnings =
    result.parserWarnings;

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

  if (typeof UrlFetchApp === "undefined") {
    result.parserWarnings.push("Decoder warning: Infinity-Data resolver is unavailable in this runtime.");
    return result;
  }

  const url =
    ARMY_CODE_VALIDATION_DEFAULTS.resolverUrl +
    "/generate?armyData=" +
    encodeURIComponent(armyCode) +
    "&unit=inch&style=a4_overview&showEquipmentWeapons=on&showSkillWeapon=on";

  const response =
    UrlFetchApp.fetch(url, {
      followRedirects: true,
      muteHttpExceptions: true
    });

  const body =
    response.getContentText();

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || body.indexOf("Army List:") === -1) {
    result.parserWarnings.push("Decoder warning: Infinity-Data resolver returned HTTP " + response.getResponseCode() + ".");
    return result;
  }

  result.armyName =
    textContent(matchArmyDecoderFirst(body, /<h2 class="card-header-title">Army List:\s*([\s\S]*?)<\/h2>/));

  const profileCards =
    parseArmyDecoderProfileCards(body);

  let profileCardIndex =
    0;

  const groupPattern =
    /<div class="army-group-title">Group:\s*(\d+)<\/div>([\s\S]*?)(?=<div class="army-group-title">|<div class="army-list-footer">)/g;

  let groupMatch =
    groupPattern.exec(body);

  while (groupMatch) {
    const combatGroup =
      Number(groupMatch[1]) || 0;

    result.combatGroups =
      Math.max(result.combatGroups, combatGroup);

    parseArmyDecoderRows(groupMatch[2], combatGroup).forEach(function(profile) {
      const profileCardMatch =
        findArmyDecoderProfileCard(profileCards, profileCardIndex, profile);

      const enrichedProfile =
        mergeArmyDecoderProfileCard(profile, profileCardMatch.card);

      profileCardIndex =
        profileCardMatch.nextIndex;

      result.points += profile.points;
      result.swc += profile.swc;
      result.roster.push(enrichedProfile);
    });

    groupMatch =
      groupPattern.exec(body);
  }

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

function buildArmyDecoderParserFailure(location, exception, reason) {

  return {
    badToken: reason === "bad token" ? exception : "",
    exception: exception,
    location: location,
    reason: reason,
    token: exception,
    unexpectedEof: reason === "unexpected EOF",
    unknownSkill: reason === "unknown skill" ? exception : "",
    unknownTroop: reason === "unknown troop" ? exception : "",
    unknownWeapon: reason === "unknown weapon" ? exception : "",
    unsupportedProfile: reason === "unsupported profile" ? exception : ""
  };

}

function getArmyDecoderFailureReason(message) {

  if (/unexpected eof/i.test(message))
    return "unexpected EOF";

  if (/unknown weapon/i.test(message))
    return "unknown weapon";

  if (/unknown skill/i.test(message))
    return "unknown skill";

  if (/unknown troop/i.test(message))
    return "unknown troop";

  if (/unsupported profile/i.test(message))
    return "unsupported profile";

  return "parser exception";

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
