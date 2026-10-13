export type VehicleKind = "car" | "bike" | "scooter";

// Curated outbound links, not scraped articles or Moto Go endorsements.
// Keep review editions visible: they may differ from today's showroom models.
export const REVIEWS = [
  {
    id: "punch", vehicle: "Tata Punch EV", type: "car" as VehicleKind, modelId: "tata-punch-ev",
    topic: "City EV · first drive", description: "A closer look at the cabin, driving experience and everyday usability.",
    review: "https://www.autocarindia.com/car-reviews/tata-punch-ev-review-feels-like-a-mini-nexon-ev-430438",
    publisher: "Autocar India", edition: "2024 written review",
    videoId: "yt-OHKTrkig", creator: "MotorInc", videoTitle: "Punch.ev · comprehensive first drive", videoEdition: "2026 video",
  },
  {
    id: "be6", vehicle: "Mahindra BE 6", type: "car" as VehicleKind, modelId: null,
    topic: "Electric SUV · road test", description: "Explore the driving experience, interior and ownership considerations.",
    review: "https://www.autocarindia.com/car-reviews-amp/mahindra-be-6-road-test-review-437526",
    publisher: "Autocar India", edition: "2025 written review",
    videoId: "RMaQtf2uUwI", creator: "Autocar India", videoTitle: "BE 6e · first drive", videoEdition: "2024 video · BE 6e launch name",
  },
  {
    id: "speed", vehicle: "Triumph Speed 400", type: "bike" as VehicleKind, modelId: "triumph-speed-400",
    topic: "Roadster · first ride", description: "A first-ride perspective on performance, comfort and fit and finish.",
    review: "https://www.autocarindia.com/bike-reviews/triumph-speed-400-review-bharatiya-british-brilliance-428756",
    publisher: "Autocar India", edition: "2023 written review",
    videoId: "yfDz6Xvg0P8", creator: "Autocar India", videoTitle: "Speed 400 · is it a real Triumph?", videoEdition: "2023 video",
  },
  {
    id: "ather", vehicle: "Ather 450X", type: "scooter" as VehicleKind, modelId: "ather-450x",
    topic: "Electric scooter · first ride", description: "Read about the riding experience and software updates in this review edition.",
    review: "https://www.autocarindia.com/bike-reviews/2025-ather-450x-review-software-update-434032",
    publisher: "Autocar India", edition: "2025 written review",
    videoId: "PYviRhBaKww", creator: "Autocar India", videoTitle: "450X · first ride and improvements", videoEdition: "2025 video",
  },
];

// Fictional examples only. No live member activity is exposed by this screen.
export const COMMUNITY = [
  { name: "Rahul", initials: "R", action: "just bought a", reviewId: "punch", badge: "New keys", tone: "go" },
  { name: "Anjali", initials: "A", action: "just drove a", reviewId: "be6", badge: "Driven", tone: "sun" },
] as const;

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
