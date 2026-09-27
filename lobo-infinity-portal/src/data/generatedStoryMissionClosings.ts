// Short continuations after the incident's turn and the hero's action. Each
// army has two alternatives to its established follow-through, so recurring
// matchups do not close with the same noun-swapped tactical sentence.
// Neither line asserts that an unreported mission objective was scored.
export const MISSION_ARMY_CLOSE_ALTERNATES: Record<string, readonly [string, string]> = {
  panoceania: [
    'The rear gunner shifted to hold a second angle into {ground}.',
    'The front paused under a surveyed line of fire near {ground}.'],
  'military-orders': [
    'An armored fighter took the exposed place near {ground}.',
    'The escort closed ranks again as return fire crossed {ground}.'],
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
    'A marine sheltered the open exit while teammates approached {ground}.'],
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
    'The patrol followed hand signals past the watch near {position}.'],
  'caledonian-highlander-army': [
    'The next rush pressed the guard near {ground}.',
    'The fighters kept the narrow breach open beside {position}.'],
  'force-de-reponse-rapide-merovingienne': [
    'The reserve held its fallback line near {ground}.',
    'A second patrol covered the response team’s route out of {position}.'],
  kosmoflot: [
    'The outside fighter held an off-angle view of {ground}.',
    'The far raider moved when a guard turned toward {position}.'],
  'tartary-army-corps': [
    'A veteran kept the nearest guard pinned beside {ground}.',
    'The forward patrol advanced under its own covering fire toward {ground}.'],
  'usariadna-ranger-force': [
    'A second patrol watched the flanking cover around {ground}.',
    'The outer scouts closed a route back beside {position}.'],
  haqqislam: [
    'The escort kept a sheltered route back from {ground}.',
    'A relief fighter watched for anyone cut off near {position}.'],
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
    'An operator signaled only after the fire slackened near {ground}.',
    'The crew kept its timing tied to the watch around {position}.'],
  'bakunin-jurisdictional-command': [
    'The decoy held the guard’s attention as fighters neared {ground}.',
    'A second route stayed quiet beside {position} under fire.'],
  'corregidor-jurisdictional-command': [
    'The improvised screen shifted with the fighters toward {ground}.',
    'A crew braced loose cover against incoming fire beside {position}.'],
  'tunguska-jurisdictional-command': [
    'A second watcher checked the exposed route into {ground}.',
    'The security team delayed its lead until the guard near {position} moved.'],
  'combined-army': [
    'The forward element kept pressure on {position} for the flanking group.',
    'A second element moved when return fire turned toward {ground}.'],
  'morat-aggression-force': [
    'The shock group held its exposed front against return fire near {ground}.',
    'A following fighter crossed after the guard fired near {position}.'],
  'next-wave': [
    'The hidden raider stayed beyond the search near {position}.',
    'A second approach remained open beside {ground} after the feint.'],
  'onyx-contact-force': [
    'A forward element held the guard’s attention near {position}.',
    'The assault line narrowed its fire around {ground} as another crossed.'],
  'shasvastii-expeditionary-force': [
    'The scout vanished behind cover short of {ground}.',
    'The concealed approach stayed open after the guard checked {position}.'],
  aleph: [
    'An observer counted the gap between volleys near {ground}.',
    'The squad moved on a signal when fire crossed {position}.'],
  'operations-subsection': [
    'The advance element signaled the rear from cover near {ground}.',
    'A lone operator kept an exit in sight beyond {position}.'],
  'steel-phalanx': [
    'A veteran sheltered the following fighters at the edge of {ground}.',
    'The front held the guard’s attention near {position}.'],
  'o-12': [
    'A second guard extended the cordon toward {ground}.',
    'The outer boundary stayed covered after fire crossed {position}.'],
  starmada: [
    'A fleet guard held the return lane from {ground}.',
    'The forward detail kept its exit in view beside {position}.'],
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
