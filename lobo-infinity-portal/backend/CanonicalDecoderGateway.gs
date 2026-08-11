/*******************************************************
 * LOBO INFINITY LEAGUE
 * CanonicalDecoderGateway.gs
 *
 * Canonical Apps Script Army Code decoder contract.
 *******************************************************/

const CANONICAL_DECODER_VERSION =
  "army-decoder-v1";

const CanonicalDecoderGateway =
  Object.freeze({
    decode: function(value) {
      return canonicalDecoderGatewayDecode_(value);
    },
    getVersion: function() {
      return CANONICAL_DECODER_VERSION;
    }
  });

function canonicalDecoderGatewayDecode_(value) {

  const raw =
    getArmyDecoderString(value);

  const extracted =
    extractArmyCodePayload(raw);

  const validation =
    inspectArmyCodeEncoding(extracted);

  const result =
    canonicalDecoderGatewayBuildEmptyResult_(raw, extracted, validation);

  if (!extracted) {
    result.parserWarnings.push("Army Code is empty.");
    result.exceptions.push("empty");
    result.parserFailure = canonicalDecoderGatewayBuildParserFailure_(
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
    return canonicalDecoderGatewayNormalizeResult_(result);
  }

  if (!validation.valid) {
    result.parserWarnings.push(validation.reason);
    result.exceptions.push(validation.reason);
    result.parserFailure = canonicalDecoderGatewayBuildParserFailure_(
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
    return canonicalDecoderGatewayNormalizeResult_(result);
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

    return canonicalDecoderGatewayNormalizeResult_(result);
  }
  catch (err) {
    result.parserWarnings.push("Decoder exception: " + String(err));
    result.exceptions.push(String(err));
    result.parserFailure = canonicalDecoderGatewayBuildParserFailure_(
      "decodeArmyCode",
      String(err),
      canonicalDecoderGatewayGetFailureReason_(String(err))
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
    return canonicalDecoderGatewayNormalizeResult_(result);
  }

}

function canonicalDecoderGatewayBuildEmptyResult_(raw, extracted, validation) {

  return {
    armyName: "",
    combatGroups: 0,
    decoderVersion: CanonicalDecoderGateway.getVersion(),
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

function canonicalDecoderGatewayNormalizeResult_(result) {

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

function canonicalDecoderGatewayBuildParserFailure_(location, exception, reason) {

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

function canonicalDecoderGatewayGetFailureReason_(message) {

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
