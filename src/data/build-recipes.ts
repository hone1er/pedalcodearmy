export type Part = {
  name: string;
  price: number;
  priceRange?: string;
  vendor?: string;
  vendorUrl?: string;
  notes?: string;
};

export type BuildTier = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  estimatedSpeed: string;
  priceRange: string;
  parts: Part[];
  tips: string[];
};

export type MopedBuild = {
  id: string;
  make: string;
  model: string;
  displayName: string;
  image?: string;
  tiers: BuildTier[];
};

export const vendors = {
  treatland: {
    name: "Treatland",
    url: "https://www.treatland.tv",
  },
  mopeds1977: {
    name: "1977 Mopeds",
    url: "https://www.1977mopeds.com",
  },
  myronsMopeds: {
    name: "Myron's Mopeds",
    url: "https://www.myronsmopeds.com",
  },
  ebay: {
    name: "eBay",
    url: "https://www.ebay.com",
  },
};

export const mopedBuilds: MopedBuild[] = [
  {
    id: "puch-maxi",
    make: "Puch",
    model: "Maxi",
    displayName: "Puch Maxi / Maxi S / Maxi N",
    tiers: [
      {
        id: "stock-tune",
        name: "Stock Tune",
        tagline: "Get it running right",
        description:
          "Before throwing money at speed parts, make sure your bone-stock setup is dialed in. A well-tuned stock moped will surprise you.",
        estimatedSpeed: "25-30 mph",
        priceRange: "$0-50",
        parts: [
          {
            name: "New Spark Plug (NGK B5HS)",
            price: 5,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jet Kit (assorted sizes)",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Get 50-72 range for stock carbs",
          },
          {
            name: "Points & Condenser",
            price: 20,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Skip if you have good spark",
          },
          {
            name: "Air Filter (mesh or foam)",
            price: 10,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "Clean your carb thoroughly - most running issues are carb-related",
          "Set points gap to 0.35-0.40mm before timing",
          "Check for air leaks at intake and crank seals",
          "Fresh fuel with proper 50:1 premix",
          "Make sure your brakes work before you make it faster!",
        ],
      },
      {
        id: "weekend-warrior",
        name: "Weekend Warrior",
        tagline: "Noticeably faster",
        description:
          "Bolt-on performance that makes a real difference. A pipe and carb/jetting will wake up your Puch without needing a new cylinder.",
        estimatedSpeed: "35-40 mph",
        priceRange: "$200-400",
        parts: [
          {
            name: "Performance Exhaust (Tecno Boss, Proma, or similar)",
            price: 120,
            priceRange: "$100-180",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Tecno Boss is a solid all-around choice",
          },
          {
            name: "Dellorto SHA 15.15 Carburetor",
            price: 55,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Upgrade from stock 14mm",
          },
          {
            name: "High-Flow Air Filter",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jets (larger for pipe/carb)",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "You'll need bigger jets with more airflow",
          },
          {
            name: "Performance Variator Weights",
            price: 20,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Tune your shift points",
          },
          {
            name: "CDI Ignition (optional)",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Better spark, no points to maintain",
          },
        ],
        tips: [
          "Pipe is the single biggest performance gain on a stock engine",
          "Upjet! A pipe needs more fuel - start rich and work down",
          "Lighter variator weights let the engine rev higher before shifting",
          "Pipe may require timing adjustment - check your manual",
          "Consider a clutch spring upgrade to match higher RPM",
        ],
      },
      {
        id: "full-send",
        name: "Full Send",
        tagline: "Maximum velocity",
        description:
          "Time to go big. A kit (aftermarket cylinder) is where real power comes from. This is serious business - expect to spend time tuning.",
        estimatedSpeed: "45-55+ mph",
        priceRange: "$600-1000+",
        parts: [
          {
            name: "Cylinder Kit (Treats 70cc, Airsal, or similar)",
            price: 200,
            priceRange: "$150-300",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "70cc kits are a sweet spot for street riding",
          },
          {
            name: "Performance Exhaust (matched to kit)",
            price: 150,
            priceRange: "$120-250",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Circuit pipe for top end, Boss style for torque",
          },
          {
            name: "Dellorto PHBG 19mm+ Carburetor",
            price: 85,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Kits need more fuel than SHA can provide",
          },
          {
            name: "Intake Manifold (matched to carb)",
            price: 30,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "CDI Ignition System",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Essential for high-RPM reliability",
          },
          {
            name: "Performance Clutch",
            price: 60,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Stock clutch can't handle the power",
          },
          {
            name: "Variator + Weights Setup",
            price: 50,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Head Work/Squish Band Tuning",
            price: 50,
            priceRange: "$0-100",
            notes: "Custom head work optimizes compression",
          },
        ],
        tips: [
          "Kits require significant tuning - this is not plug and play",
          "Match your pipe to your kit - manufacturers usually recommend combos",
          "You'll need to re-jet every time you change altitude or season",
          "Invest in a good plug chop routine to dial in jetting",
          "Consider rebuilding your bottom end while it's apart",
          "Upgraded brakes are not optional at these speeds!",
        ],
      },
    ],
  },
  {
    id: "puch-magnum",
    make: "Puch",
    model: "Magnum",
    displayName: "Puch Magnum / Magnum X",
    tiers: [
      {
        id: "stock-tune",
        name: "Stock Tune",
        tagline: "Get it running right",
        description:
          "The Magnum shares its engine with the Maxi. Same tuning principles apply - start with a clean carb and fresh ignition.",
        estimatedSpeed: "28-33 mph",
        priceRange: "$0-50",
        parts: [
          {
            name: "New Spark Plug (NGK B5HS)",
            price: 5,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jet Kit",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Points & Condenser",
            price: 20,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Fresh Fuel Line",
            price: 8,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "Magnums are slightly heavier - they may feel slower than a Maxi",
          "Check the ZA50 transmission fluid level",
          "The 2-speed transmission needs proper adjustment",
          "Front drum brakes need regular adjustment",
        ],
      },
      {
        id: "weekend-warrior",
        name: "Weekend Warrior",
        tagline: "Wake it up",
        description:
          "Same E50/ZA50 engine as Maxi. Pipe and carb upgrades translate directly. The ZA50 2-speed transmission handles power well.",
        estimatedSpeed: "38-45 mph",
        priceRange: "$200-400",
        parts: [
          {
            name: "Performance Exhaust",
            price: 130,
            priceRange: "$100-180",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Dellorto SHA 15.15",
            price: 55,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "High-Flow Air Filter",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jet Assortment",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "CDI Ignition",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "ZA50 can handle more power than E50 - good platform for kits",
          "Transmission tune matters - adjust shift points via clutches",
          "Suspension is better than Maxi - can handle higher speeds",
        ],
      },
      {
        id: "full-send",
        name: "Full Send",
        tagline: "Magnum force",
        description:
          "ZA50 2-speed transmission is actually better suited for kits than E50. You can build serious power on this platform.",
        estimatedSpeed: "50-60+ mph",
        priceRange: "$700-1200+",
        parts: [
          {
            name: "70cc+ Cylinder Kit",
            price: 220,
            priceRange: "$150-350",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Race Exhaust",
            price: 180,
            priceRange: "$150-300",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "PHBG 19-21mm Carburetor",
            price: 90,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Intake + Reed Valve Setup",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Reed valve adds significant power",
          },
          {
            name: "CDI Ignition",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Clutch Upgrade",
            price: 70,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Brake Upgrades",
            price: 100,
            priceRange: "$50-150",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Front disc conversion recommended",
          },
        ],
        tips: [
          "ZA50 trans can actually hold more power than E50",
          "Consider trans fluid upgrade to synthetic",
          "Shift clunk is normal - adjust clutches for smooth shifts",
          "Magnum frame handles high speed better than Maxi",
        ],
      },
    ],
  },
  {
    id: "honda-hobbit",
    make: "Honda",
    model: "Hobbit",
    displayName: "Honda Hobbit PA50",
    tiers: [
      {
        id: "stock-tune",
        name: "Stock Tune",
        tagline: "Honda reliability",
        description:
          "Hobbits are known for reliability. A stock Hobbit in good tune is a solid daily rider. The variator system is different from Puch.",
        estimatedSpeed: "28-30 mph",
        priceRange: "$0-50",
        parts: [
          {
            name: "Spark Plug (NGK BR6HS)",
            price: 5,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Air Filter Element",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Carb Rebuild Kit",
            price: 20,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Points (if applicable)",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "PA50I has points, PA50II has CDI - know which you have",
          "Hobbit variators are user-adjustable with different ramps",
          "Stock Keihin carb is actually quite good",
          "Check variator belt condition - cracks = replace",
        ],
      },
      {
        id: "weekend-warrior",
        name: "Weekend Warrior",
        tagline: "Pocket rocket",
        description:
          "Hobbits respond well to pipe and carb upgrades. The variator system allows for good tuning of power delivery.",
        estimatedSpeed: "38-45 mph",
        priceRange: "$250-450",
        parts: [
          {
            name: "Performance Exhaust (Proma, Treats pipe)",
            price: 140,
            priceRange: "$100-200",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Mikuni VM18 Carburetor",
            price: 70,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Popular upgrade from stock Keihin",
          },
          {
            name: "Intake Manifold",
            price: 30,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "High-Flow Air Filter",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Variator Weights",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Tune shift points to match pipe",
          },
          {
            name: "Clutch Springs",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "Hobbit variator tuning is its own art form",
          "Treats makes Hobbit-specific parts - check their catalog",
          "The PA50 CDI is reliable - no need to upgrade unless failing",
          "Variator ramps affect how power comes on",
        ],
      },
      {
        id: "full-send",
        name: "Full Send",
        tagline: "Hobbit go fast",
        description:
          "Kitted Hobbits can be absolute rippers. The variator system, when properly tuned, puts power down efficiently.",
        estimatedSpeed: "50-60+ mph",
        priceRange: "$700-1100+",
        parts: [
          {
            name: "Polini or Treats 70cc Kit",
            price: 250,
            priceRange: "$200-350",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Race Exhaust",
            price: 180,
            priceRange: "$150-250",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Mikuni VM20 Carburetor",
            price: 85,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Reed Valve Intake",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Treats Variator Setup",
            price: 100,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "Complete variator with tuning options",
          },
          {
            name: "Performance Clutch Bell",
            price: 50,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "CDI (if PA50I)",
            price: 80,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "Hobbit kits are well-developed - good support available",
          "Variator tuning is CRITICAL on kitted Hobbits",
          "The belt must be in good condition to handle power",
          "Consider reinforcing the subframe at high power levels",
          "Join Moped Army forums for Hobbit-specific advice",
        ],
      },
    ],
  },
  {
    id: "derbi-variant",
    make: "Derbi",
    model: "Variant",
    displayName: "Derbi Variant / Flat Reed",
    tiers: [
      {
        id: "stock-tune",
        name: "Stock Tune",
        tagline: "Spanish engineering",
        description:
          "Derbis are underrated! The flat reed engine is unique and capable. Start by making sure everything is sealed and timed properly.",
        estimatedSpeed: "28-32 mph",
        priceRange: "$0-75",
        parts: [
          {
            name: "Spark Plug",
            price: 5,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jet Kit",
            price: 15,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
            notes: "Derbi-specific sizes",
          },
          {
            name: "Reed Petals",
            price: 25,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
            notes: "Check for chips or warping",
          },
          {
            name: "Crank Seals",
            price: 20,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
            notes: "Derbis are known for seal leaks",
          },
        ],
        tips: [
          "Derbi crank seals are notorious for leaking - check them",
          "The flat reed design requires good reed condition",
          "Points timing is critical on these engines",
          "Parts are available but less common than Puch",
        ],
      },
      {
        id: "weekend-warrior",
        name: "Weekend Warrior",
        tagline: "Spanish fly",
        description:
          "Derbis wake up nicely with exhaust and carb work. The TJT variator is a popular upgrade path.",
        estimatedSpeed: "38-45 mph",
        priceRange: "$250-450",
        parts: [
          {
            name: "Tecno Boss or Estoril Exhaust",
            price: 130,
            priceRange: "$100-180",
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "Dellorto SHA 15.15",
            price: 55,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "TJT Variator",
            price: 80,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
            notes: "Major improvement over stock variator",
          },
          {
            name: "Performance Reed Petals",
            price: 30,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "High-Flow Air Filter",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "TJT variator is almost mandatory for performance",
          "Estoril pipe is torquey, good for street",
          "Check for intake air leaks religiously",
          "Derbi carb boots are often cracked",
        ],
      },
      {
        id: "full-send",
        name: "Full Send",
        tagline: "Olé!",
        description:
          "Kitted Derbis are serious machines. The Autisa and Metrakit cylinders are well-regarded. The flat reed design flows well with big kits.",
        estimatedSpeed: "50-60+ mph",
        priceRange: "$600-1000+",
        parts: [
          {
            name: "Autisa or Metrakit 65-70cc",
            price: 200,
            priceRange: "$150-300",
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "Race Exhaust (matched to kit)",
            price: 160,
            priceRange: "$130-250",
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "PHBG 19mm Carburetor",
            price: 85,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "TJT Variator (if not already installed)",
            price: 80,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "Performance Clutch",
            price: 60,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
          {
            name: "CDI Ignition",
            price: 90,
            vendor: "1977 Mopeds",
            vendorUrl: "https://www.1977mopeds.com",
          },
        ],
        tips: [
          "Derbi kits are less common but very capable",
          "The flat reed design can move a lot of air",
          "Bottom end is strong but check crank bearings",
          "1977 Mopeds is the go-to for Derbi parts",
          "Join Derbi-specific groups for build advice",
        ],
      },
    ],
  },
  {
    id: "tomos",
    make: "Tomos",
    model: "A35/A55",
    displayName: "Tomos A35 / A55",
    tiers: [
      {
        id: "stock-tune",
        name: "Stock Tune",
        tagline: "Yugoslav precision",
        description:
          "Tomos bikes are newer and generally reliable. The A35/A55 engines share many parts. Start with basic maintenance.",
        estimatedSpeed: "28-30 mph",
        priceRange: "$0-50",
        parts: [
          {
            name: "Spark Plug (NGK B5HS)",
            price: 5,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Air Filter",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jet Kit",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Transmission Fluid",
            price: 10,
            notes: "Check and top up regularly",
          },
        ],
        tips: [
          "Tomos uses ATF in the transmission - check level regularly",
          "Stock Dellorto carbs are decent",
          "Newer bikes may still have restrictor in exhaust",
          "A35 is single-speed, A55 is 2-speed automatic",
        ],
      },
      {
        id: "weekend-warrior",
        name: "Weekend Warrior",
        tagline: "Tomas go fast",
        description:
          "Tomos bikes respond well to performance parts. The engine architecture is proven and well-supported.",
        estimatedSpeed: "38-45 mph",
        priceRange: "$200-400",
        parts: [
          {
            name: "Biturbo or Tecno Exhaust",
            price: 110,
            priceRange: "$80-150",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Dellorto SHA 15.15",
            price: 55,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "High-Flow Air Filter",
            price: 25,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Jets (larger)",
            price: 15,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "CDI Ignition (A35)",
            price: 75,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
            notes: "A35 has points, A55 already has CDI",
          },
        ],
        tips: [
          "Biturbo is a classic budget pipe",
          "Remove exhaust restrictor if present",
          "A55 2-speed trans benefits from clutch tuning",
          "Watch for intake cracks at the reed block",
        ],
      },
      {
        id: "full-send",
        name: "Full Send",
        tagline: "Full Tomos",
        description:
          "Tomos kits are readily available. The A35/A55 bottom end can handle reasonable power. Popular build platform.",
        estimatedSpeed: "50-60+ mph",
        priceRange: "$600-1000+",
        parts: [
          {
            name: "Airsal or Polini 70cc Kit",
            price: 180,
            priceRange: "$140-250",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Performance Exhaust",
            price: 150,
            priceRange: "$100-200",
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "PHBG 19mm Carb",
            price: 85,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Intake + Reeds",
            price: 70,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "Performance Clutch (A55)",
            price: 55,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
          {
            name: "CDI (A35)",
            price: 75,
            vendor: "Treatland",
            vendorUrl: "https://www.treatland.tv",
          },
        ],
        tips: [
          "Tomos parts are generally affordable",
          "A55 2-speed handles kits well",
          "Lots of build threads online for reference",
          "Bottom end is the weak point at high power",
          "Consider crank bearings if going big",
        ],
      },
    ],
  },
];

export function getMopedBuildById(id: string): MopedBuild | undefined {
  return mopedBuilds.find((build) => build.id === id);
}

export function calculateTierTotal(tier: BuildTier): { min: number; max: number } {
  let min = 0;
  let max = 0;

  tier.parts.forEach((part) => {
    if (part.priceRange) {
      const [minPrice, maxPrice] = part.priceRange
        .replace(/\$/g, "")
        .split("-")
        .map((p) => parseInt(p, 10));
      min += minPrice ?? part.price;
      max += maxPrice ?? part.price;
    } else {
      min += part.price;
      max += part.price;
    }
  });

  return { min, max };
}
