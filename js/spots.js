// Spot + fish knowledge base for Cape Town kayak fishing.
// Edit this file to add spots, tweak seasons or change launch sites.

/** Inclusive month range that can wrap the year end, e.g. months(11, 3) -> [11,12,1,2,3] */
function months(a, b) {
  const out = [];
  let m = a;
  for (;;) {
    out.push(m);
    if (m === b) break;
    m = (m % 12) + 1;
  }
  return out;
}
const ALL_YEAR = months(1, 12);

// temp = sea-surface temperature band (°C) the species feeds best in.
const FISH = {
  yellowtail: {
    name: 'Yellowtail', latin: 'Seriola lalandi', temp: [16, 22],
    method: 'Live maasbanker or sardine, metal jigs and poppers over reef and around bait balls.',
  },
  snoek: {
    name: 'Snoek', latin: 'Thyrsites atun', temp: [11, 16],
    method: 'Drift sardine or chokka, or jig chrome spoons and feathers. Watch for diving birds.',
  },
  hottentot: {
    name: 'Hottentot', latin: 'Pachymetopon blochii', temp: [11, 20],
    method: 'Small hooks with redbait, chokka or prawn close to kelp and reef.',
  },
  redRoman: {
    name: 'Red roman', latin: 'Chrysoblephus laticeps', temp: [12, 20],
    method: 'Chokka or sardine on the bottom over deeper reef (20–40 m). Strict bag limit.',
  },
  kob: {
    name: 'Kob', latin: 'Argyrosomus spp.', temp: [15, 23],
    method: 'Chokka, sardine or live mullet; soft paddle-tails at dawn and dusk on sand/reef edges.',
  },
  geelbek: {
    name: 'Geelbek (Cape salmon)', latin: 'Atractoscion aequidens', temp: [15, 21],
    method: 'Live bait or chokka near reef at first light, often in the same water as kob.',
  },
  elf: {
    name: 'Elf (shad)', latin: 'Pomatomus saltatrix', temp: [15, 22],
    method: 'Spoons, spinners or sardine near broken water.',
    closed: { from: [10, 1], to: [11, 30], label: 'Closed season 1 Oct – 30 Nov' },
  },
  smoothhound: {
    name: 'Smooth-hound shark', latin: 'Mustelus mustelus', temp: [12, 20],
    method: 'Chokka or sardine on sand. Please catch and release.',
  },
  blacktail: {
    name: 'Blacktail', latin: 'Diplodus capensis', temp: [14, 22],
    method: 'Prawn, redbait or bread flake in rocky shallows.',
  },
  panga: {
    name: 'Panga', latin: 'Pterogymnus laniarius', temp: [11, 17],
    method: 'Fish deeper (40 m+) with chokka strips on a two-hook rig.',
  },
  whiteSteenbras: {
    name: 'White steenbras', latin: 'Lithognathus lithognathus', temp: [15, 22],
    method: 'Prawn, cracker shrimp or worm off sandy beaches. Stocks have collapsed, so release them.',
  },
  maasbanker: {
    name: 'Maasbanker (bait)', latin: 'Trachurus capensis', temp: [14, 20],
    method: 'Sabiki rigs at dawn. They are the best live bait for yellowtail.',
  },
  stJoseph: {
    name: 'St Joseph shark', latin: 'Callorhinchus capensis', temp: [10, 17],
    method: 'Sardine or chokka on a running sinker over sand just behind the surf. Mostly a summer fish on the West Coast. Handle carefully (it has a sharp dorsal spine) and release it.',
  },
  chokka: {
    name: 'Chokka squid', latin: 'Loligo reynaudii', temp: [13, 19],
    method: 'Squid jigs (size 2.5–3.0) worked slowly over sand and low reef in 10–30 m, best at dusk, at night or on overcast days. Fresh chokka is also the top bait for almost everything else on this list.',
    note: 'The main chokka grounds are on the Eastern Cape coast, so around Cape Town catches are patchy. The commercial fishery closes for a few weeks each year around Oct–Nov. Check the DFFE rules for recreational squid limits.',
  },
};

// facing = compass bearing looking from the launch out to sea.
// Wind blowing FROM the opposite direction is offshore and can push a kayak out to sea.
const SPOTS = [
  // ---------------- West Coast ----------------
  {
    id: 'melkbos',
    name: 'Melkbosstrand',
    side: 'West Coast',
    lat: -33.7265, lon: 18.4395,
    marineLat: -33.73, marineLon: 18.42,
    facing: 255,
    launch: 'Melkbosstrand main beach (surf launch, no harbour)',
    notes: [
      'This is a <b>surf launch</b> with no harbour or slipway. When the swell is up the shore-break dumps, so only go on small-swell days and be confident punching out and landing through surf.',
      'The summer south-easter blows <b>cross-offshore</b> here and fills in through the morning. Early starts are usually calmest. Winter is often glassy between fronts.',
      'The water is cold West Coast water, often 10–14 °C after upwelling. Dress for falling in (a wetsuit, not boardies).',
      'Koeberg power station, just to the north, is a restricted security area, so keep well clear. You are outside the Table Mountain MPA here, but you still need a permit and must follow the bag limits.',
    ],
    fish: [
      { id: 'snoek', present: months(3, 9), peak: months(4, 7), abundance: 0.75 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.8 },
      { id: 'stJoseph', present: months(10, 4), peak: months(11, 2), abundance: 0.7 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(11, 3), abundance: 0.7 },
      { id: 'whiteSteenbras', present: months(10, 3), peak: months(12, 2), abundance: 0.25 },
      { id: 'yellowtail', present: months(12, 3), peak: months(1, 2), abundance: 0.2 },
    ],
  },
  // ---------------- Atlantic Seaboard ----------------
  {
    id: 'seapoint',
    name: 'Sea Point',
    side: 'Atlantic Seaboard',
    lat: -33.9137, lon: 18.3842,
    marineLat: -33.905, marineLon: 18.37,
    facing: 300,
    launch: 'Three Anchor Bay slipway',
    notes: [
      'A south-easter is <b>offshore</b> here and gusts off Lion\'s Head. It can push you out to sea, so be careful when it is up.',
      'This is open Atlantic water. Big south-west swells make launching and landing dangerous.',
      'After a strong south-easter the water can drop to 9–12 °C through upwelling. Most fish slow down, but snoek like it.',
      'You are inside the Table Mountain National Park MPA. You need a valid recreational permit, and some zones are restricted.',
    ],
    fish: [
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.7 },
      { id: 'snoek', present: months(3, 9), peak: months(5, 8), abundance: 0.9 },
      { id: 'panga', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.6 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(11, 3), abundance: 0.6 },
      { id: 'yellowtail', present: months(12, 4), peak: months(1, 3), abundance: 0.35 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.3 },
      { id: 'maasbanker', present: months(11, 4), peak: months(12, 3), abundance: 0.7 },
    ],
  },
  {
    id: 'houtbay',
    name: 'Hout Bay',
    side: 'Atlantic Seaboard',
    lat: -34.0490, lon: 18.3530,
    marineLat: -34.065, marineLon: 18.35,
    facing: 175,
    launch: 'Hout Bay harbour slipway',
    notes: [
      'The bay is sheltered from most swell, so it often stays paddleable when Sea Point is too rough.',
      'The south-easter roars down the valley and off the Sentinel. It is <b>offshore</b> and very gusty, so watch the gust numbers closely.',
      'Hout Bay is a traditional snoek harbour. In autumn and winter the fleet and the birds show you where the fish are.',
      'Karbonkelberg, on the western side towards Sandy Bay, is a restricted (no-take) MPA zone. Lots of seals and boat traffic around the harbour.',
    ],
    fish: [
      { id: 'snoek', present: months(3, 9), peak: months(4, 8), abundance: 1 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.6 },
      { id: 'yellowtail', present: months(11, 4), peak: months(12, 3), abundance: 0.5 },
      { id: 'panga', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.6 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(11, 3), abundance: 0.6 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.3 },
      { id: 'maasbanker', present: months(11, 4), peak: months(12, 3), abundance: 0.7 },
    ],
  },
  // ---------------- False Bay, west side ----------------
  {
    id: 'fishhoek',
    name: 'Fish Hoek',
    side: 'False Bay (west)',
    lat: -34.1372, lon: 18.4325,
    marineLat: -34.145, marineLon: 18.45,
    facing: 115,
    launch: 'Fish Hoek beach (Jager\'s Walk end). Kalk Bay harbour is just north.',
    notes: [
      'An easy, sandy beach launch with Shark Spotters on duty and a shark exclusion net in season. A good option for a relaxed day.',
      'The sandy bottom suits kob, elf and steenbras. Head for the rocky edges towards Clovelly or Sunny Cove for hottentot.',
      'A north-westerly is <b>offshore</b> here. A summer south-easter blows straight onshore and builds a short, steep chop.',
      'Kalk Bay harbour is busy with boats. Keep clear of the channel, and of the trek-net fishermen on the beach.',
    ],
    fish: [
      { id: 'yellowtail', present: months(10, 5), peak: months(12, 3), abundance: 0.8 },
      { id: 'kob', present: months(10, 4), peak: months(12, 2), abundance: 0.7 },
      { id: 'elf', present: months(12, 5), peak: months(1, 4), abundance: 0.7 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.8 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.8 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(10, 3), abundance: 0.7 },
      { id: 'whiteSteenbras', present: months(10, 3), peak: months(12, 2), abundance: 0.3 },
      { id: 'blacktail', present: ALL_YEAR, peak: months(11, 4), abundance: 0.6 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.45 },
      { id: 'maasbanker', present: months(10, 4), peak: months(12, 3), abundance: 0.8 },
    ],
  },
  {
    id: 'simonstown',
    name: "Simon's Town",
    side: 'False Bay (west)',
    lat: -34.1840, lon: 18.4280,
    marineLat: -34.20, marineLon: 18.455,
    facing: 70,
    launch: 'Long Beach, next to the False Bay Yacht Club',
    notes: [
      'The <b>SA Navy base</b> is the harbour in the middle of town. It is a restricted military area, so don\'t paddle or fish inside the naval harbour or near its walls. Launch from Long Beach and head out away from the base.',
      'North-westerly winter fronts blow <b>offshore</b> here. The water near the shore looks calm, but the wind pushes you out into the bay.',
      'In summer the south-easter blows across the bay and chop builds by late morning, so go at first light.',
      'Boulders (the penguin colony, just south of the base) is a no-take MPA zone. Do not fish there.',
    ],
    fish: [
      { id: 'yellowtail', present: months(10, 5), peak: months(11, 4), abundance: 1 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.9 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.8 },
      { id: 'kob', present: months(11, 3), peak: months(12, 2), abundance: 0.45 },
      { id: 'elf', present: months(12, 5), peak: months(1, 4), abundance: 0.6 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(10, 3), abundance: 0.6 },
      { id: 'blacktail', present: ALL_YEAR, peak: months(11, 4), abundance: 0.6 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.45 },
      { id: 'maasbanker', present: months(10, 4), peak: months(12, 3), abundance: 0.8 },
    ],
  },
  {
    id: 'millerspoint',
    name: "Miller's Point",
    side: 'False Bay (west)',
    lat: -34.2312, lon: 18.4748,
    marineLat: -34.235, marineLon: 18.495,
    facing: 80,
    launch: "Miller's Point slipway",
    notes: [
      'This is the classic False Bay yellowtail launch. Deep water and reef are close in, so you don\'t have to paddle far.',
      'The slipway is shared with ski-boats, so launch to the side and keep out of their way, especially early on summer weekends.',
      'Castle Rock, just south, is a restricted (no-take) MPA zone. Check the SANParks zone map before you drop a line.',
      'North-westerlies are <b>offshore</b>. Southern right and humpback whales pass through between about Jun and Nov, so give them space.',
    ],
    fish: [
      { id: 'yellowtail', present: months(10, 5), peak: months(11, 4), abundance: 1 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.9 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.9 },
      { id: 'panga', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.5 },
      { id: 'elf', present: months(12, 5), peak: months(1, 4), abundance: 0.5 },
      { id: 'kob', present: months(11, 3), peak: months(12, 2), abundance: 0.3 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.4 },
      { id: 'maasbanker', present: months(10, 4), peak: months(12, 3), abundance: 0.8 },
    ],
  },
  {
    id: 'capepoint',
    name: 'Cape Point',
    side: 'False Bay (Buffels Bay)',
    lat: -34.3190, lon: 18.4630,
    marineLat: -34.32, marineLon: 18.48,
    facing: 85,
    launch: 'Buffels Bay, inside the Cape of Good Hope section of the national park',
    // Approximate SANParks gate times: summer ~06:00–18:00, winter ~07:00–17:00. Check before you go.
    access: (month) => (month >= 10 || month <= 3 ? { open: 7, close: 18 } : { open: 8, close: 17 }),
    notes: [
      'You launch inside the national park, so you pay the gate fee and keep to gate hours. There is no first-light launch here. The app only suggests windows that start about an hour after the gates open (to allow for the drive in) and end before they close.',
      'Buffels Bay faces east into False Bay, so it is sheltered from the Atlantic swell and from north-westerlies. Those blow <b>offshore</b> here, though.',
      'The south-easter hits Cape Point harder than almost anywhere else on the peninsula, and the weather can turn quickly. Currents run strong towards the point itself, so stay inside the bay unless it is dead calm. This is a spot for experienced paddlers.',
      'There are MPA restricted (no-take) zones along this coast. Check the SANParks zone map before you fish. Watch out for baboons at the car park, and don\'t leave food in the car.',
    ],
    fish: [
      { id: 'yellowtail', present: months(10, 5), peak: months(11, 4), abundance: 1 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.8 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.9 },
      { id: 'panga', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.7 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(10, 3), abundance: 0.5 },
      { id: 'kob', present: months(11, 3), peak: months(12, 2), abundance: 0.3 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.35 },
      { id: 'maasbanker', present: months(10, 4), peak: months(12, 3), abundance: 0.7 },
    ],
  },
  // ---------------- False Bay, east side ----------------
  {
    id: 'falsebay',
    name: "Gordon's Bay",
    side: 'False Bay (east)',
    lat: -34.1595, lon: 18.8655,
    marineLat: -34.175, marineLon: 18.84,
    facing: 225,
    launch: "Gordon's Bay harbour / Bikini Beach",
    notes: [
      'The south-easter can come off the Hottentots Holland mountains in strong gusts. Check the gust numbers as well as the average wind.',
      'In summer the bay is warmer than the Atlantic side, so yellowtail, kob and geelbek come in.',
      'Great white sharks use False Bay. Paddle with a buddy and check the Shark Spotters flag status.',
      'Parts of False Bay are MPA no-take zones. Check the DFFE / SANParks maps before you fish.',
    ],
    fish: [
      { id: 'yellowtail', present: months(10, 5), peak: months(12, 3), abundance: 1 },
      { id: 'kob', present: months(10, 4), peak: months(12, 2), abundance: 0.75 },
      { id: 'geelbek', present: months(10, 3), peak: months(11, 1), abundance: 0.6 },
      { id: 'elf', present: months(12, 5), peak: months(1, 4), abundance: 0.7 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.75 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.9 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.7 },
      { id: 'smoothhound', present: ALL_YEAR, peak: months(10, 3), abundance: 0.7 },
      { id: 'whiteSteenbras', present: months(10, 3), peak: months(12, 2), abundance: 0.3 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.5 },
      { id: 'maasbanker', present: months(10, 4), peak: months(12, 3), abundance: 0.8 },
    ],
  },
  {
    id: 'rooiels',
    name: 'Rooi-Els',
    side: 'False Bay (east)',
    lat: -34.2985, lon: 18.8175,
    marineLat: -34.30, marineLon: 18.80,
    facing: 245,
    launch: 'Rooi-Els beach, at the river mouth off Clarence Drive',
    notes: [
      'Deep water and rugged reef sit close in along the Kogelberg coast. It is quieter and wilder than the western side of the bay.',
      'It is open to the south-west swell, so you get surge on the rocks and dumping shore-break on big days. Only go when the swell is small.',
      'This is a remote stretch. Take a VHF radio, and tell someone your plan and when you\'ll be back.',
      'Parts of the Kogelberg coast are MPA restricted zones. Check before you fish.',
    ],
    fish: [
      { id: 'yellowtail', present: months(11, 5), peak: months(12, 4), abundance: 0.85 },
      { id: 'hottentot', present: ALL_YEAR, peak: ALL_YEAR, abundance: 1 },
      { id: 'redRoman', present: ALL_YEAR, peak: months(10, 4), abundance: 0.9 },
      { id: 'panga', present: ALL_YEAR, peak: ALL_YEAR, abundance: 0.6 },
      { id: 'snoek', present: months(5, 9), peak: months(6, 8), abundance: 0.6 },
      { id: 'geelbek', present: months(10, 3), peak: months(11, 1), abundance: 0.4 },
      { id: 'kob', present: months(11, 3), peak: months(12, 2), abundance: 0.3 },
      { id: 'chokka', present: months(10, 3), peak: months(11, 1), abundance: 0.4 },
    ],
  },
];

// No-go areas shown on the map (approximate positions; always check official maps).
const NO_GO = [
  { name: 'SA Navy base, Simon\'s Town', lat: -34.1915, lon: 18.4350, note: 'Restricted military harbour. No paddling or fishing inside.' },
  { name: 'Koeberg power station', lat: -33.6765, lon: 18.4320, note: 'Restricted security area (National Key Point). Keep well clear on the water.' },
  { name: 'Boulders penguin colony', lat: -34.1972, lon: 18.4515, note: 'MPA no-take zone.' },
];

window.FISH = FISH;
window.SPOTS = SPOTS;
window.NO_GO = NO_GO;
