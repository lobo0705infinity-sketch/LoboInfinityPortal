/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * DeepLinkApi.gs
 *
 * Canonical portal deep-link service for automation,
 * Discord embeds, timeline events, and future Open Graph.
 *******************************************************/

function buildDeepLink(type, data) {

  data = data || {};

  const path =
    getDeepLinkPath(type, data);

  const title =
    getDeepLinkTitle(type, data);

  const description =
    getDeepLinkDescription(type, data);

  return {
    type: getDeepLinkString(type),
    path: path,
    url: getPortalCanonicalUrl(path),
    title: title,
    description: description,
    previewImage:
      getDeepLinkPreviewImage(type, data)
  };

}

function getDeepLinkPath(type, data) {

  const normalizedType =
    getDeepLinkString(type);

  switch (normalizedType) {

    case "game":
    case "gameSubmitted":
    case "matchResult":
      return "/game/" + encodeURIComponent(getDeepLinkId(data.gameId || data.id));

    case "player":
    case "playerOfTheWeek":
    case "playerJoined":
    case "identityLinked":
      return "/player/" + encodeURIComponent(getDeepLinkPlayer(data));

    case "career":
    case "promotion":
    case "relegation":
      return "/career/" + encodeURIComponent(getDeepLinkPlayer(data));

    case "achievement":
    case "achievementUnlocked":
      return "/achievement/" + encodeURIComponent(getDeepLinkId(data.achievementId || data.id || data.name));

    case "faction":
    case "factionLeaderChanges":
      return "/faction/" + encodeURIComponent(getDeepLinkString(data.faction || data.name));

    case "mission":
    case "missionRotation":
      return "/mission/" + encodeURIComponent(getDeepLinkString(data.mission || data.name));

    case "season":
    case "seasonStarted":
    case "seasonEnded":
    case "seasonCountdown":
      return "/season/" + encodeURIComponent(getDeepLinkString(data.season || data.currentSeasonName || getSeasonStatusObject().currentSeasonName));

    case "weeklyReport":
    case "weeklyStandings":
    case "weeklyRecap":
      return "/weekly-report";

    case "news":
    case "leagueNews":
    case "commissionerNews":
      return data.newsId || data.id
        ? "/news/" + encodeURIComponent(getDeepLinkId(data.newsId || data.id))
        : "/news";

    case "stream":
    case "streamScheduled":
    case "newStream":
      return data.streamId || data.id
        ? "/stream/" + encodeURIComponent(getDeepLinkId(data.streamId || data.id))
        : "/streams";

    case "armyList":
    case "armyListSubmitted":
    case "armyListApproved":
    case "armyListOfTheWeek":
      return data.listId || data.id
        ? "/army-list/" + encodeURIComponent(getDeepLinkId(data.listId || data.id))
        : "/army-lists";

    case "hallOfFame":
    case "hallOfFameInduction":
    case "leagueChampion":
    case "divisionChampion":
    case "recordBroken":
    case "leagueRecordsBroken":
      return "/hall-of-fame";

    case "standings":
      return "/standings";

    case "automation":
      return "/automation";

    case "commissioner":
      return "/commissioner";

    default:
      return "/";

  }

}

function getDeepLinkTitle(type, data) {

  const normalizedType =
    getDeepLinkString(type);

  switch (normalizedType) {

    case "game":
    case "gameSubmitted":
    case "matchResult":
      return (
        getDeepLinkString(data.winner) +
        " defeated " +
        getDeepLinkString(data.loser)
      ).trim() || "Match Result";

    case "achievement":
    case "achievementUnlocked":
      return getDeepLinkString(data.name || data.title) || "Achievement Unlocked";

    case "player":
    case "playerOfTheWeek":
      return getPlayerDisplayName(getDeepLinkPlayer(data)) || "Player Profile";

    case "career":
    case "promotion":
    case "relegation":
      return getPlayerDisplayName(getDeepLinkPlayer(data)) + " Career";

    case "faction":
    case "factionLeaderChanges":
      return getDeepLinkString(data.faction || data.name) || "Faction Profile";

    case "mission":
    case "missionRotation":
      return getDeepLinkString(data.mission || data.name) || "Mission Profile";

    case "weeklyReport":
    case "weeklyStandings":
    case "weeklyRecap":
      return "Weekly League Report";

    case "hallOfFame":
    case "hallOfFameInduction":
      return "Hall of Fame";

    default:
      return "Lobo Infinity League";

  }

}

function getDeepLinkDescription(type, data) {

  const normalizedType =
    getDeepLinkString(type);

  if (data.description)
    return getDeepLinkString(data.description);

  if (data.message)
    return getDeepLinkString(data.message);

  switch (normalizedType) {

    case "game":
    case "gameSubmitted":
    case "matchResult":
      return "Open the full match report.";

    case "achievement":
    case "achievementUnlocked":
      return "Open the achievement record.";

    case "player":
    case "playerOfTheWeek":
      return "Open the league player profile.";

    case "career":
    case "promotion":
    case "relegation":
      return "Open the player career record.";

    case "weeklyReport":
    case "weeklyStandings":
    case "weeklyRecap":
      return "Open the current standings and weekly league report.";

    default:
      return "Open the Lobo Infinity League Portal.";

  }

}

function getDeepLinkPreviewImage(type, data) {

  const settings =
    getSettingsObject();

  return (
    getDeepLinkString(data.previewImage) ||
    getDeepLinkString(data.thumbnailUrl) ||
    getDeepLinkString(settings.bannerImage) ||
    getDeepLinkString(settings.leagueLogo) ||
    ""
  );

}

function getPortalCanonicalUrl(path) {

  const settings =
    getSettingsObject();

  const base =
    getDeepLinkString(settings.deploymentUrl) ||
    "https://lobo-infinity-portal.vercel.app";

  const normalizedPath =
    getDeepLinkString(path) || "/";

  return base.replace(/\/$/, "") +
    (normalizedPath.charAt(0) === "/" ? normalizedPath : "/" + normalizedPath);

}

function getDeepLinkPlayer(data) {

  return getDeepLinkString(
    data.leaguePlayer ||
    data.player ||
    data.winner ||
    data.name
  );

}

function getDeepLinkId(value) {

  const normalized =
    getDeepLinkString(value);

  return normalized || "latest";

}

function getDeepLinkString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}
