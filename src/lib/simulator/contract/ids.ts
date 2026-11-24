// Frozen contract IDs for Ran When Parked — Moped Simulator

export type SimBikeMake =
  | "puch-maxi"
  | "honda-hobbit"
  | "derbi-variant"
  | "tomos-a35";

export type SimPhase =
  | "GARAGE"
  | "MAP"
  | "RUNNER"
  | "RIDE"
  | "ROADSIDE"
  | "SHOP"
  | "CRAIGSLIST";

export type PartSlot =
  | "spark-plug"
  | "main-jet"
  | "carburetor"
  | "exhaust"
  | "cylinder"
  | "air-filter"
  | "fuel-filter"
  | "ignition"
  | "intake-gasket"
  | "clutch"
  | "belt";

export type UpgradeId =
  | "gauge-tach"
  | "gauge-cht"
  | "tool-stethoscope";

export type ToolId =
  | "visual"
  | "plug-chop"
  | "spark-tester"
  | "carb-spray"
  | "compression-gauge"
  | "fuel-flow"
  | "clutch-check"
  | "premix-check";

export type HotspotId =
  | "spark-plug"
  | "cylinder"
  | "carburetor"
  | "intake-gasket"
  | "fuel-filter"
  | "exhaust"
  | "ignition"
  | "clutch"
  | "gas-tank"
  | "rear-wheel";

export type FaultId =
  | "rich-jet"
  | "lean-jet"
  | "air-leak"
  | "fouled-plug"
  | "weak-spark"
  | "no-spark"
  | "clogged-fuel"
  | "low-compression"
  | "clutch-slip"
  | "no-premix";

export type RouteId =
  | "telegraph-coffee"
  | "lake-merritt-cruise"
  | "grizzly-peak-climb"
  | "midnight-tunnel";

export type PlugColor =
  | "tan-ideal"
  | "black-wet"
  | "black-sooty"
  | "white-lean"
  | "white-blistered"
  | "oily-fouled"
  | "dry-clean";

export type SmokeTint =
  | "clear"
  | "light-blue"
  | "thick-blue-grey"
  | "white-steam";

export type MisfirePattern =
  | "none"
  | "alternate" // Classic rich 4-stroking: blub-blub-blub
  | "random" // Fouled plug stutter
  | "high-rpm" // Weak spark breaking up at high RPM
  | "dead"; // No spark / no fuel

export type ShopVendorId =
  | "bay-mopeds"
  | "golden-gate-parts"
  | "east-bay-speed";
