/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * PlayerRegistry.gs
 *
 *******************************************************/

const PLAYER = {

  NAME: 0,

  DISPLAY_NAME: 1,

  DIVISION: 2,

  ACTIVE: 3

};

let playerDisplayNameCache = null;
const PLAYER_REGISTRY_CACHE_KEY = "playerRegistry:v1";
const PLAYER_REGISTRY_CACHE_TTL_SECONDS = 21600;

function loadPlayers() {

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.players.spreadsheet.getActive"
    );

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  endDashboardEndpointSubStage(
    "dashboard.players.spreadsheet.getActiveAndSheetLookup",
    timer,
    {
      sheet: CONFIG.SHEETS.PLAYERS
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.players.getDataRange.getValues.initial"
    );

  const data =
    sheet
      .getDataRange()
      .getValues();

  endDashboardEndpointSubStage(
    "dashboard.players.getDataRange.getValues.initial",
    timer,
    {
      sheet: CONFIG.SHEETS.PLAYERS,
      rows: data.length
    }
  );

  if (data.length <= 1)
    return [];

  const headers =
    data.shift();

  const hadDisplayNameColumn =
    getPlayerRegistryColumns(headers).displayName !== -1;

  const columns =
    ensurePlayerDisplayNameColumn(
      sheet,
      headers
    );

  let values = data;

  if (!hadDisplayNameColumn) {
    timer =
      startDashboardEndpointSubStage(
        "dashboard.players.getDataRange.getValues.normalized"
      );

    values =
      sheet
        .getDataRange()
        .getValues();

    endDashboardEndpointSubStage(
      "dashboard.players.getDataRange.getValues.normalized",
      timer,
      {
        sheet: CONFIG.SHEETS.PLAYERS,
        rows: values.length
      }
    );

    values.shift();
  }

  timer =
    startDashboardEndpointSubStage(
      "dashboard.players.loop.normalize"
    );

  const normalized =
    values.map(function(row) {
      return normalizePlayerRegistryRow(
        row,
        columns
      );
    });

  endDashboardEndpointSubStage(
    "dashboard.players.loop.normalize",
    timer,
    {
      rows: values.length
    }
  );

  return normalized;

}

function ensurePlayerDisplayNameColumn(sheet, headers) {

  let columns =
    getPlayerRegistryColumns(headers);

  if (columns.displayName !== -1)
    return columns;

  const playerColumn =
    columns.player === -1
      ? PLAYER.NAME
      : columns.player;

  sheet.insertColumnAfter(playerColumn + 1);

  sheet
    .getRange(1, playerColumn + 2)
    .setValue("Display Name");

  invalidatePlayerRegistryCache();

  const nextHeaders =
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

  columns =
    getPlayerRegistryColumns(nextHeaders);

  playerDisplayNameCache = null;

  return columns;

}

function setLeaguePlayerDisplayName(playerName, displayName) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    throw new Error("Players sheet not found.");

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    throw new Error("Players sheet has no player rows.");

  const headers =
    values[0];

  const columns =
    ensurePlayerDisplayNameColumn(
      sheet,
      headers
    );

  const target =
    getPlayerRegistryString(playerName)
      .toLowerCase();

  for (
    let index = 1;
    index <= sheet.getLastRow() - 1;
    index++
  ) {

    const rowNumber =
      index + 1;

    const player =
      getPlayerRegistryString(
        sheet
          .getRange(rowNumber, columns.player + 1)
          .getValue()
      );

    if (player.toLowerCase() !== target)
      continue;

    sheet
      .getRange(rowNumber, columns.displayName + 1)
      .setValue(
        getPlayerRegistryString(displayName)
      );

    invalidatePlayerRegistryCache();

    if (typeof invalidatePortalCacheGroup === "function")
      invalidatePortalCacheGroup("all");

    return {
      success: true,
      player: player,
      displayName:
        getPlayerRegistryString(displayName) ||
        player
    };

  }

  throw new Error(
    "Player not found: " + playerName
  );

}

function createPlayer(row) {

  return {

    player: row[PLAYER.NAME],

    displayName:
      row[PLAYER.DISPLAY_NAME] ||
      row[PLAYER.NAME],

    division: row[PLAYER.DIVISION],

    active: row[PLAYER.ACTIVE] === true,

    games: 0,

    wins: 0,

    losses: 0,

    draws: 0,

    tp: 0,

    op: 0,

    vp: 0

  };

}

function getPlayerRegistryColumns(headers) {

  return {
    player:
      getPlayerRegistryColumn(headers, "Player", PLAYER.NAME),
    displayName:
      getPlayerRegistryColumn(headers, "Display Name", -1),
    division:
      getPlayerRegistryColumn(headers, "Division", PLAYER.DIVISION),
    active:
      getPlayerRegistryColumn(headers, "Active", PLAYER.ACTIVE)
  };

}

function getPlayerRegistryColumn(headers, label, fallback) {

  const index =
    headers.indexOf(label);

  return index === -1
    ? fallback
    : index;

}

function normalizePlayerRegistryRow(row, columns) {

  const player =
    getPlayerRegistryString(
      row[columns.player]
    );

  const displayName =
    columns.displayName === -1
      ? ""
      : getPlayerRegistryString(
          row[columns.displayName]
        );

  return [
    player,
    displayName || player,
    getPlayerRegistryString(
      row[columns.division]
    ),
    row[columns.active] === true
  ];

}

function getPlayerRegistryString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getPlayerDisplayName(playerName) {

  const normalizedName =
    getPlayerRegistryString(playerName);

  if (normalizedName === "")
    return "";

  const map =
    getPlayerDisplayNameMap();

  const normalizedLower =
    normalizedName.toLowerCase();

  for (const player in map) {

    if (player.toLowerCase() === normalizedLower)
      return map[player] || player;

  }

  return normalizedName;

}

function getPlayerDisplayNameMap() {

  if (playerDisplayNameCache)
    return playerDisplayNameCache;

  const registry =
    buildPlayerRegistry();

  playerDisplayNameCache =
    buildPlayerDisplayNameMapFromRegistry(
      registry
    );

  return playerDisplayNameCache;

}

function buildPlayerDisplayNameMapFromRegistry(registry) {

  const map = {};

  Object.keys(registry)
    .forEach(function(playerName) {
      const player =
        registry[playerName];

      map[player.player] =
        player.displayName ||
        player.player;
    });

  return map;

}

function clonePlayerRegistry(registry) {

  const clone = {};

  Object.keys(registry)
    .forEach(function(playerName) {
      const player =
        registry[playerName];

      clone[playerName] = {
        player: player.player,
        displayName: player.displayName,
        division: player.division,
        active: player.active,
        games: player.games,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        tp: player.tp,
        op: player.op,
        vp: player.vp
      };
    });

  return clone;

}

function findPlayerRegistryEntry(registry, playerName) {

  if (registry[playerName])
    return registry[playerName];

  const normalizedName =
    getPlayerRegistryString(playerName)
      .toLowerCase();

  for (const key in registry) {

    if (
      getPlayerRegistryString(key)
        .toLowerCase() === normalizedName
    )
      return registry[key];

  }

  return null;

}

function buildPlayerRegistry() {

  const timer =
    startDashboardEndpointSubStage(
      "dashboard.players.buildRegistry"
    );

  const cached =
    readPlayerRegistryCache();

  if (cached) {
    endDashboardEndpointSubStage(
      "dashboard.players.buildRegistry",
      timer,
      {
        cache: "hit",
        players: Object.keys(cached).length
      }
    );

    return clonePlayerRegistry(
      cached
    );
  }

  const registry = {};

  loadPlayers()

    .forEach(function(row) {

      if (row[PLAYER.ACTIVE] !== true)
        return;

      const player =
        createPlayer(row);

      registry[player.player] = player;

    });

  endDashboardEndpointSubStage(
    "dashboard.players.buildRegistry",
    timer,
    {
      cache: "miss",
      players: Object.keys(registry).length
    }
  );

  writePlayerRegistryCache(
    registry
  );

  return clonePlayerRegistry(
    registry
  );

}

function readPlayerRegistryCache() {

  try {
    const cached =
      CacheService
        .getScriptCache()
        .get(PLAYER_REGISTRY_CACHE_KEY);

    if (!cached)
      return null;

    const registry =
      JSON.parse(cached);

    if (!registry || typeof registry !== "object")
      return null;

    return registry;
  }
  catch (err) {
    return null;
  }

}

function writePlayerRegistryCache(registry) {

  try {
    CacheService
      .getScriptCache()
      .put(
        PLAYER_REGISTRY_CACHE_KEY,
        JSON.stringify(registry),
        PLAYER_REGISTRY_CACHE_TTL_SECONDS
      );
  }
  catch (err) {
    Logger.log(
      "Player Registry cache write skipped: " + err
    );
  }

}

function invalidatePlayerRegistryCache() {

  playerDisplayNameCache =
    null;

  try {
    CacheService
      .getScriptCache()
      .remove(PLAYER_REGISTRY_CACHE_KEY);

    if (typeof invalidateDashboardLeagueOverviewCache === "function")
      invalidateDashboardLeagueOverviewCache();
  }
  catch (err) {
    Logger.log(
      "Player Registry cache invalidation skipped: " + err
    );
  }

}

function testRegistry() {

  const registry =
    buildPlayerRegistry();

  Logger.log(registry);

}
