// Short continuations after the incident's turn and the hero's action. Each
// army has two alternatives to its established follow-through, so recurring
// matchups do not close with the same noun-swapped tactical sentence.
// Neither line asserts that an unreported mission objective was scored.
export const MISSION_ARMY_CLOSE_ALTERNATES: Record<string, readonly [string, string]> = {
  panoceania: [
    'At {ground}, a rear gunner adjusted the team’s angle.',
    'Near {ground}, the lead paused inside a surveyed line of fire.'],
  'military-orders': [
    'An armored fighter took the exposed place near {ground}.',
    'Across {ground}, the escort reformed behind armor before another volley hit.'],
  'kestrel-colonial-force': [
    'A second scout watched the far edge of {ground}.',
    'The patrol kept the side crossing in view beside {ground}.'],
  'neoterra-capitaline-army': [
    'The perimeter tightened where another fighter approached {ground}.',
    'A guard closed the outer gap without abandoning {position}.'],
  'shock-army-of-acontecimento': [
    'Another veteran moved between shelters at the edge of {ground}.',
    'The patrol covered the newly exposed step beside {ground}.'],
  'svalarheima-winter-force': [
    'A rear fighter held the narrow crossing toward {ground}.',
    'The patrol waited under cover as fire reached {position}.'],
  'varuna-immediate-reaction-division': [
    'The relief detail marked a route back from {ground}.',
    'By {position}, a marine shielded the exit as teammates approached {ground}.'],
  'yu-jing': [
    'The next volley pinned a guard near {position}.',
    'A second line covered the forward fighters beside {ground}.'],
  'imperial-service': [
    'An investigator signaled the reserve after the watch shifted near {position}.',
    'The detail kept the newly exposed gap toward {ground} under observation.'],
  'invincible-army': [
    'The heavy front kept its shield facing {position}.',
    'A second fighter absorbed fire near {ground} for the advancing group.'],
  'white-banner': [
    'A scout kept sight of both elevations beyond {ground}.',
    'The lower patrol watched for fire from {position}.'],
  ariadna: [
    'A rear scout crossed quietly within sight of {ground}.',
    'Past {position}, scouts followed hand signals around the guard toward {ground}.'],
  'caledonian-highlander-army': [
    'The next rush pressed the guard near {ground}.',
    'The fighters kept the narrow breach open beside {position}.'],
  'force-de-reponse-rapide-merovingienne': [
    'The reserve held its fallback line near {ground}.',
    'From {position}, another patrol kept the response team’s retreat in view.'],
  kosmoflot: [
    'The outside fighter held an off-angle view of {ground}.',
    'At {position}, a distant raider waited for the guard to turn.'],
  'tartary-army-corps': [
    'A veteran kept the nearest guard pinned beside {ground}.',
    'Toward {ground}, a forward patrol advanced under its own covering fire.'],
  'usariadna-ranger-force': [
    'A second patrol watched the flanking cover around {ground}.',
    'The outer scouts closed a route back beside {position}.'],
  haqqislam: [
    'The escort kept a sheltered route back from {ground}.',
    'Near {position}, a medic kept a retrieval route open.'],
  'hassassin-bahram': [
    'The concealed fighter waited beyond the guard near {position}.',
    'A second shadow kept the quiet approach into {ground} open.'],
  'qapu-khalqi': [
    'A guard held the exit while another covered {ground}.',
    'The contract team stayed within reach of its return lane beside {position}.'],
  'ramah-taskforce': [
    'A relief fighter replaced the exposed escort near {ground}.',
    'The front held a protected route out from {position}.'],
  nomads: [
    'At {ground}, an operator signaled the crew after the firing slackened.',
    'Near {position}, the crew matched its timing to the opposing watch.'],
  'bakunin-jurisdictional-command': [
    'Beside {ground}, a decoy drew the watch off course.',
    'A second route stayed quiet beside {position} under fire.'],
  'corregidor-jurisdictional-command': [
    'The improvised screen shifted with the fighters toward {ground}.',
    'A crew braced loose cover against incoming fire beside {position}.'],
  'tunguska-jurisdictional-command': [
    'A second watcher checked the exposed route into {ground}.',
    'By {position}, the security team waited for a gap.'],
  'combined-army': [
    'The forward element kept pressure on {position} for the flanking group.',
    'Toward {ground}, a second assault element moved during the return volley.'],
  'morat-aggression-force': [
    'The shock group held its exposed front against return fire near {ground}.',
    'Beside {position}, another fighter crossed after the guard’s shot.'],
  'next-wave': [
    'The hidden raider stayed beyond the search near {position}.',
    'A staged feint drew fire toward {position}, leaving a second approach open beside {ground}.'],
  'onyx-contact-force': [
    'A forward element held the guard’s attention near {position}.',
    'The assault line narrowed its fire around {ground} as another crossed.'],
  'shasvastii-expeditionary-force': [
    'The scout vanished behind cover short of {ground}.',
    'The concealed approach stayed open after the guard checked {position}.'],
  aleph: [
    'An observer counted the gap between volleys near {ground}.',
    'From {position}, the squad crossed on a signal between volleys.'],
  'operations-subsection': [
    'The advance element signaled the rear from cover near {ground}.',
    'A lone operator kept an exit in sight beyond {position}.'],
  'steel-phalanx': [
    'At {ground}, a veteran shielded the following fighters as the guard turned.',
    'The front held the guard’s attention near {position}.'],
  'o-12': [
    'A second guard extended the cordon toward {ground}.',
    'The outer boundary stayed covered after fire crossed {position}.'],
  starmada: [
    'A fleet guard held the return lane from {ground}.',
    'Near {position}, a fleet guard marked the advancing detail’s escape route.'],
  'torchlight-brigade': [
    'A relief fighter reached the threatened front near {ground}.',
    'The reserve stood ready as fire reached {position}.'],
  'japanese-secessionist-army': [
    'A close fighter kept the guard watching {position}.',
    'The threat of another charge opened space toward {ground}.'],
  oban: [
    'The unchallenged scout watched the approach beside {ground}.',
    'The hidden patrol held its path behind the guard near {position}.'],
  shindenbutai: [
    'A forward fighter kept the blind side of {position} in view.',
    'The next operative sheltered the exposed crossing toward {ground}.'],
  tohaa: [
    'The trio passed its exposed lead back toward {ground}.',
    'A second fighter screened the third near {position}.'],
  'dashat-company': [
    'Two hired gunners kept separate angles on {ground}.',
    'The rear contract team stayed within sight of {position}.'],
  'druze-bayram-security': [
    'The contract gunner maintained a line across {ground}.',
    'The paid guard held the return angle from {position}.'],
  'ikari-company': [
    'The next fighter rushed the gap beside {ground}.',
    'The first rush held the guard’s attention near {position}.'],
  starco: [
    'The recovery detail kept its way back from {ground}.',
    'A rear fighter covered the lead from beside {position}.'],
  'white-company': [
    'A second guard watched the quiet approach into {ground}.',
    'The reserve covered a return lane from {position}.'],
}
