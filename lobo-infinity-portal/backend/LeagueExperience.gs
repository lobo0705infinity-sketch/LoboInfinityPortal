/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * LeagueExperience.gs
 *
 * Notifications and timeline endpoints generated from
 * live league data.
 *******************************************************/

const EXPERIENCE_LIMIT = 20;

function getNotifications(e) {

  const auth =
    getRequestUser(e);

  const notifications =
    applyUserNotificationState(
      buildLeagueNotifications(),
      auth.user
    );

  return jsonOutput({
    success: true,
    notifications: notifications
  });

}

function applyUserNotificationState(notifications, user) {

  if (
    !user ||
    !user.email
  )
    return notifications;

  const dismissed =
    listToLookup(user.dismissedAlerts || []);

  const archived =
    listToLookup(user.archivedAlerts || []);

  const read =
    listToLookup(user.readAlerts || []);

  return notifications
    .filter(function(notification) {
      return (
        !dismissed[notification.id] &&
        !archived[notification.id]
      );
    })
    .map(function(notification) {

      notification.unread =
        !read[notification.id];

      return notification;

    });

}

function listToLookup(items) {

  const lookup = {};

  items.forEach(function(item) {

    const key =
      String(item || "").trim();

    if (key !== "")
      lookup[key] = true;

  });

  return lookup;

}

function getTimeline() {

  return jsonOutput({
    success: true,
    timeline:
      buildLeagueTimeline()
  });

}

function buildLeagueNotifications() {

  const games =
    getAllRecentGameObjects();

  const standings =
    getLeagueIntelligenceStandings();

  const records =
    getLeagueRecords(
      games
    );

  const notifications = [];

  games
    .slice(0, 5)
    .forEach(function(game, index) {

      notifications.push(
        buildLeagueNotification({
          id: "game-" + game.id,
          type: "New Game",
          title:
            game.winner +
            " defeated " +
            game.loser,
          body:
            game.mission +
            " ended " +
            game.vp +
            " in " +
            game.division +
            ".",
          timestamp: game.date,
          link: "/games/" + game.id,
          priority: index === 0 ? "high" : "normal"
        })
      );

    });

  getLeagueWinStreaks("W")
    .slice(0, 3)
    .forEach(function(streak) {

      notifications.push(
        buildLeagueNotification({
          id: "win-streak-" + streak.player,
          type: "Winning Streak",
          title:
            streak.player +
            " has momentum",
          body: streak.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(streak.player),
          priority: "high"
        })
      );

    });

  getLeagueWinStreaks("L")
    .slice(0, 2)
    .forEach(function(streak) {

      notifications.push(
        buildLeagueNotification({
          id: "loss-streak-" + streak.player,
          type: "Losing Streak",
          title:
            streak.player +
            " needs a response",
          body: streak.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(streak.player),
          priority: "normal"
        })
      );

    });

  getPromotionBattle(
    standings.divisions
  )
    .slice(0, 3)
    .forEach(function(item) {

      notifications.push(
        buildLeagueNotification({
          id:
            "promotion-" +
            item.division +
            "-" +
            item.player,
          type: "Promotion Movement",
          title: "Promotion race update",
          body: item.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(item.player),
          priority: item.withinOneGame ? "high" : "normal"
        })
      );

    });

  getRelegationBattle(
    standings.divisions
  )
    .slice(0, 3)
    .forEach(function(item) {

      notifications.push(
        buildLeagueNotification({
          id:
            "relegation-" +
            item.division +
            "-" +
            item.player,
          type: "Relegation Movement",
          title: "Relegation watch update",
          body: item.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(item.player),
          priority: item.withinOneGame ? "high" : "normal"
        })
      );

    });

  addRecordNotification(
    notifications,
    "record-vp-margin",
    "New VP margin record",
    records.largestVPMargin
  );

  addRecordNotification(
    notifications,
    "record-op-margin",
    "New OP margin record",
    records.largestOPMargin
  );

  addRecordNotification(
    notifications,
    "record-high-score",
    "Highest scoring game tracked",
    records.highestScoringGame
  );

  const hallLeader =
    getHallOfFameStandings()[0];

  if (hallLeader)
    notifications.push(
      buildLeagueNotification({
        id: "hall-of-fame-" + hallLeader.player,
        type: "Hall of Fame",
        title:
          hallLeader.player +
          " headlines the Hall of Fame",
        body:
          hallLeader.player +
          " is currently among the league leaders with " +
          hallLeader.tp +
          " TP.",
        timestamp: getLeagueExperienceTimestamp(),
        link: "/hall-of-fame",
        priority: "normal"
      })
    );

  return notifications
    .slice(0, EXPERIENCE_LIMIT);

}

function buildLeagueTimeline() {

  const games =
    getAllRecentGameObjects();

  const news =
    getGeneratedCommissionerNews();

  const standings =
    getLeagueIntelligenceStandings();

  const records =
    getLeagueRecords(
      games
    );

  const timeline = [];

  games
    .forEach(function(game) {

      timeline.push(
        buildTimelineItem({
          id: "game-" + game.id,
          type: "Game Played",
          title:
            game.winner +
            " defeated " +
            game.loser,
          body:
            game.mission +
            " finished " +
            game.vp +
            " in " +
            game.division +
            ".",
          timestamp: game.date,
          link: "/games/" + game.id,
          relatedPlayer: game.winner,
          relatedFaction: game.winnerFaction,
          relatedMission: game.mission
        })
      );

    });

  news
    .forEach(function(article) {

      timeline.push(
        buildTimelineItem({
          id: "news-" + article.id,
          type: "League News",
          title: article.title,
          body: article.body,
          timestamp: article.date,
          link: article.link,
          relatedPlayer: article.relatedPlayer,
          relatedFaction: article.relatedFaction,
          relatedMission: article.relatedMission
        })
      );

    });

  addRecordTimelineItem(
    timeline,
    "record-vp-margin",
    "Largest VP margin",
    records.largestVPMargin
  );

  addRecordTimelineItem(
    timeline,
    "record-op-margin",
    "Largest OP margin",
    records.largestOPMargin
  );

  getPromotionBattle(
    standings.divisions
  )
    .forEach(function(item) {

      timeline.push(
        buildTimelineItem({
          id:
            "promotion-" +
            item.division +
            "-" +
            item.player,
          type: "Promotion Movement",
          title: "Promotion pressure",
          body: item.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(item.player),
          relatedPlayer: item.player
        })
      );

    });

  getRelegationBattle(
    standings.divisions
  )
    .forEach(function(item) {

      timeline.push(
        buildTimelineItem({
          id:
            "relegation-" +
            item.division +
            "-" +
            item.player,
          type: "Relegation Movement",
          title: "Danger zone update",
          body: item.story,
          timestamp: getLeagueExperienceTimestamp(),
          link:
            "/players/" +
            encodeURIComponent(item.player),
          relatedPlayer: item.player
        })
      );

    });

  const hallLeader =
    getHallOfFameStandings()[0];

  if (hallLeader)
    timeline.push(
      buildTimelineItem({
        id: "hall-of-fame-" + hallLeader.player,
        type: "Hall of Fame",
        title:
          hallLeader.player +
          " leads a Hall of Fame board",
        body:
          hallLeader.player +
          " owns " +
          hallLeader.tp +
          " TP and " +
          hallLeader.vp +
          " VP in " +
          hallLeader.division +
          ".",
        timestamp: getLeagueExperienceTimestamp(),
        link: "/hall-of-fame",
        relatedPlayer: hallLeader.player
      })
    );

  return timeline
    .sort(function(a, b) {

      return (
        getRecentGameDate(b.timestamp).getTime() -
        getRecentGameDate(a.timestamp).getTime()
      );

    })
    .slice(0, EXPERIENCE_LIMIT);

}

function addRecordNotification(
  notifications,
  id,
  title,
  record
) {

  if (!record || !record.id)
    return;

  notifications.push(
    buildLeagueNotification({
      id: id,
      type: "Record",
      title: title,
      body: record.story,
      timestamp: record.date || getLeagueExperienceTimestamp(),
      link: "/games/" + record.id,
      priority: "high"
    })
  );

}

function addRecordTimelineItem(
  timeline,
  id,
  title,
  record
) {

  if (!record || !record.id)
    return;

  timeline.push(
    buildTimelineItem({
      id: id,
      type: "Record Broken",
      title: title,
      body: record.story,
      timestamp: record.date || getLeagueExperienceTimestamp(),
      link: "/games/" + record.id,
      relatedPlayer: record.winner,
      relatedFaction: record.winnerFaction,
      relatedMission: record.mission
    })
  );

}

function buildLeagueNotification(item) {

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    timestamp: item.timestamp || getLeagueExperienceTimestamp(),
    link: item.link || "",
    unread: true,
    priority: item.priority || "normal"
  };

}

function buildTimelineItem(item) {

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    timestamp: item.timestamp || getLeagueExperienceTimestamp(),
    link: item.link || "",
    relatedPlayer: item.relatedPlayer || "",
    relatedFaction: item.relatedFaction || "",
    relatedMission: item.relatedMission || ""
  };

}

function getLeagueExperienceTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

}
