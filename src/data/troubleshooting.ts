export type TroubleshootingNode = {
  id: string;
  type: "question" | "diagnosis";
  title: string;
  description?: string;
  options?: {
    label: string;
    nextId: string;
  }[];
  diagnosis?: {
    problem: string;
    solution: string;
    difficulty: "easy" | "moderate" | "advanced";
    parts?: string[];
    tips?: string[];
  };
};

export type TroubleshootingCategory = {
  id: string;
  name: string;
  icon: string;
  description: string;
  startNodeId: string;
  nodes: TroubleshootingNode[];
};

export const troubleshootingCategories: TroubleshootingCategory[] = [
  {
    id: "wont-start",
    name: "Won't Start",
    icon: "🔑",
    description: "Your moped refuses to wake up? Let's figure out why.",
    startNodeId: "start-1",
    nodes: [
      {
        id: "start-1",
        type: "question",
        title: "Did you mix oil in your gas?",
        description: "Be honest with us. We won't judge... much.",
        options: [
          { label: "Yes, 50:1 like a responsible adult", nextId: "start-2" },
          { label: "Uh... was I supposed to?", nextId: "diag-no-oil" },
          { label: "I'm not sure", nextId: "diag-check-oil" },
        ],
      },
      {
        id: "diag-no-oil",
        type: "diagnosis",
        title: "No Premix Oil",
        diagnosis: {
          problem: "Running straight gas without 2-stroke oil",
          solution:
            "STOP! Do not try to start it again. Drain the tank and add properly mixed fuel (50:1 or as specified by manufacturer). If you already ran it without oil, your engine may have seized. Try turning the engine over by hand - if it won't move, you might need a rebuild.",
          difficulty: "easy",
          parts: ["2-stroke premix oil", "Fresh gasoline"],
          tips: [
            "Always mix oil! 2-strokes need it for lubrication",
            "Keep pre-mixed fuel in a separate marked container",
            "Most mopeds run 50:1 but check your manual",
          ],
        },
      },
      {
        id: "diag-check-oil",
        type: "diagnosis",
        title: "Check Your Fuel Mix",
        diagnosis: {
          problem: "Uncertain fuel mixture",
          solution:
            "Drain your tank and start fresh with properly mixed fuel. Use 50:1 ratio (2.6 oz oil per gallon of gas) unless your manual specifies otherwise. Use quality 2-stroke oil.",
          difficulty: "easy",
          parts: ["2-stroke premix oil", "Fresh gasoline"],
          tips: [
            "When in doubt, drain it out",
            "Old gas goes bad after 30 days",
            "Label your gas can with the date you mixed it",
          ],
        },
      },
      {
        id: "start-2",
        type: "question",
        title: "Is there fuel getting to the carb?",
        description:
          "Turn the petcock to ON and disconnect the fuel line at the carb. Does fuel flow out?",
        options: [
          { label: "Yes, fuel flows", nextId: "start-3" },
          { label: "No fuel or just dribbles", nextId: "diag-fuel-flow" },
          { label: "What's a petcock?", nextId: "diag-petcock-101" },
        ],
      },
      {
        id: "diag-fuel-flow",
        type: "diagnosis",
        title: "Fuel Flow Issue",
        diagnosis: {
          problem: "Fuel not reaching the carburetor",
          solution:
            "Check these in order: 1) Petcock is turned ON, 2) Fuel filter is not clogged, 3) Fuel line is not kinked or cracked, 4) Tank cap vent is clear (try loosening the cap), 5) Petcock itself may be clogged - remove and clean or replace.",
          difficulty: "easy",
          parts: ["Fuel filter", "Fuel line", "Petcock rebuild kit (if needed)"],
          tips: [
            "Blow through the fuel line to check for blockages",
            "Rust in tank is a common culprit - consider a tank treatment",
            "Inline fuel filters are cheap insurance",
          ],
        },
      },
      {
        id: "diag-petcock-101",
        type: "diagnosis",
        title: "Petcock Basics",
        diagnosis: {
          problem: "Not familiar with fuel system components",
          solution:
            "The petcock is the fuel valve on your tank. It usually has OFF, ON, and RES (reserve) positions. Make sure it's turned to ON (or RES if low on fuel). The fuel line runs from here to your carburetor.",
          difficulty: "easy",
          tips: [
            "Always turn petcock OFF when storing",
            "RES uses fuel from lower in the tank - it's your backup",
            "Some petcocks are vacuum-operated (auto)",
          ],
        },
      },
      {
        id: "start-3",
        type: "question",
        title: "Do you have spark?",
        description:
          "Remove the spark plug, connect it to the wire, ground the plug against the engine, and kick it over. Do you see a blue spark?",
        options: [
          { label: "Yes, strong blue spark", nextId: "start-4" },
          { label: "Weak or orange spark", nextId: "diag-weak-spark" },
          { label: "No spark at all", nextId: "start-spark-diag" },
        ],
      },
      {
        id: "start-spark-diag",
        type: "question",
        title: "Let's trace the spark issue",
        description: "Is the kill switch in the RUN position?",
        options: [
          { label: "Yes, it's on RUN", nextId: "diag-no-spark" },
          { label: "Oops, it was on KILL", nextId: "diag-kill-switch" },
          { label: "I don't have a kill switch", nextId: "diag-no-spark" },
        ],
      },
      {
        id: "diag-kill-switch",
        type: "diagnosis",
        title: "Kill Switch Was Off",
        diagnosis: {
          problem: "Kill switch in OFF/KILL position",
          solution:
            "Flip the kill switch to RUN and try again. We've all been there.",
          difficulty: "easy",
          tips: [
            "Always check the simple stuff first",
            "Some kill switches are finicky - wiggle it while testing",
          ],
        },
      },
      {
        id: "diag-weak-spark",
        type: "diagnosis",
        title: "Weak Ignition",
        diagnosis: {
          problem: "Weak spark indicates ignition system degradation",
          solution:
            "Start with the easy stuff: 1) Replace the spark plug - they're cheap and often the culprit. 2) Check spark plug wire for cracks or corrosion. 3) Clean or replace the points if you have a points ignition. 4) Check the condenser. 5) Coil might be failing - test or swap.",
          difficulty: "moderate",
          parts: ["Spark plug (NGK B5HS or equivalent)", "Points", "Condenser"],
          tips: [
            "Always carry a spare plug",
            "Gap your plug correctly (usually 0.6-0.7mm)",
            "CDI ignitions are generally more reliable than points",
          ],
        },
      },
      {
        id: "diag-no-spark",
        type: "diagnosis",
        title: "No Spark - Ignition Failure",
        diagnosis: {
          problem: "Complete ignition system failure",
          solution:
            "Check in order: 1) Spark plug and wire connection, 2) Kill switch wiring (disconnect it to test), 3) Ground wire from stator to frame, 4) Points/CDI - if points, check gap and condition. If CDI, test or swap. 5) Ignition coil - test resistance or swap. 6) Stator/magneto - check for damaged windings.",
          difficulty: "advanced",
          parts: ["Spark plug", "Ignition coil", "Points/CDI unit", "Stator (if damaged)"],
          tips: [
            "Disconnect the kill switch to eliminate it as a cause",
            "Check all ground connections - corrosion kills spark",
            "Wiring diagrams for your specific bike are your friend",
          ],
        },
      },
      {
        id: "start-4",
        type: "question",
        title: "Does it try to fire at all?",
        description:
          "When you kick it, do you hear any popping, coughing, or signs of life?",
        options: [
          { label: "Yes, it tries but won't catch", nextId: "diag-almost-running" },
          { label: "Nothing at all, dead silent", nextId: "diag-compression" },
          { label: "It backfires through the carb", nextId: "diag-timing" },
        ],
      },
      {
        id: "diag-almost-running",
        type: "diagnosis",
        title: "Almost Running - Likely Carb Issue",
        diagnosis: {
          problem: "Engine tries to fire but won't sustain",
          solution:
            "You have spark and fuel delivery, so the carb is probably dirty or misadjusted. 1) Remove and clean the carburetor - pay special attention to jets and passages. 2) Check that the choke is working. 3) Replace gaskets if brittle. 4) Check for air leaks at the intake.",
          difficulty: "moderate",
          parts: ["Carb rebuild kit", "Carb cleaner", "Intake gasket"],
          tips: [
            "Soak the carb body in carb cleaner overnight",
            "Use compressed air to blow out all passages",
            "Don't stick wires in jets - you'll enlarge them",
            "Check float height and needle valve",
          ],
        },
      },
      {
        id: "diag-compression",
        type: "diagnosis",
        title: "Check Compression",
        diagnosis: {
          problem: "No signs of life could mean low compression",
          solution:
            "Do a compression test. You should see 90-150 PSI depending on the engine. Low compression causes: 1) Worn piston rings, 2) Scored cylinder, 3) Blown head gasket, 4) Leaking base gasket. You may need a top-end rebuild.",
          difficulty: "advanced",
          parts: ["Compression tester", "Piston rings", "Gasket set", "Possibly cylinder kit"],
          tips: [
            "A little oil in the spark plug hole can temporarily seal rings for testing",
            "If compression improves with oil, rings are worn",
            "Check for air leaks at base and head gaskets",
          ],
        },
      },
      {
        id: "diag-timing",
        type: "diagnosis",
        title: "Timing Issue",
        diagnosis: {
          problem: "Backfiring suggests ignition timing is off",
          solution:
            "Check and set your ignition timing. For points systems: 1) Set points gap first (usually 0.35-0.40mm), 2) Use a timing light or multimeter to set timing to spec (usually 1.5-2mm BTDC). For CDI: timing is usually fixed but check the stator position.",
          difficulty: "advanced",
          parts: ["Feeler gauges", "Timing light or dial indicator"],
          tips: [
            "Always set points gap BEFORE timing",
            "Woodruff key shearing can throw timing way off",
            "Some CDI systems are adjustable, some aren't",
          ],
        },
      },
    ],
  },
  {
    id: "bogs-high-rpm",
    name: "Bogs at High RPM",
    icon: "📈",
    description: "Runs fine at low speed but falls on its face when you open it up?",
    startNodeId: "bog-1",
    nodes: [
      {
        id: "bog-1",
        type: "question",
        title: "When does it bog?",
        description: "Describe when exactly you lose power.",
        options: [
          { label: "When I open the throttle quickly", nextId: "bog-2" },
          { label: "Gradually loses power at high RPM", nextId: "bog-3" },
          { label: "Four-strokes/stutters at WOT", nextId: "diag-rich-high" },
        ],
      },
      {
        id: "bog-2",
        type: "question",
        title: "Quick throttle response issue",
        description: "Does it eventually recover if you hold it open?",
        options: [
          { label: "Yes, it catches up", nextId: "diag-lean-transition" },
          { label: "No, it dies or stays bogged", nextId: "diag-accel-circuit" },
        ],
      },
      {
        id: "diag-lean-transition",
        type: "diagnosis",
        title: "Lean Transition",
        diagnosis: {
          problem: "Lean condition during throttle transition",
          solution:
            "The transition between idle and main jet circuits is too lean. 1) Raise the needle clip position (lower the clip = richer), 2) Check that the slide is moving freely, 3) Look for air leaks at intake or carb mounting.",
          difficulty: "moderate",
          parts: ["Carb needle clips"],
          tips: [
            "Moving the clip down one notch is a good starting point",
            "Air leaks are a common cause - spray carb cleaner around intake while running",
            "If it hisses when spraying, you found your leak",
          ],
        },
      },
      {
        id: "diag-accel-circuit",
        type: "diagnosis",
        title: "Accelerator Circuit Issue",
        diagnosis: {
          problem: "Fuel delivery can't keep up with sudden throttle opening",
          solution:
            "Most moped carbs don't have accelerator pumps, so this is usually air leak or jet size issue. 1) Check for air leaks, 2) Try a larger pilot jet, 3) Check that the choke is fully off, 4) Float level might be too low.",
          difficulty: "moderate",
          parts: ["Pilot jets (various sizes)", "Intake gasket"],
          tips: [
            "Test by slightly choking it while accelerating - if it helps, you're lean",
            "Old rubber intake boots crack and cause major leaks",
          ],
        },
      },
      {
        id: "bog-3",
        type: "question",
        title: "Gradual power loss",
        description: "Does it feel like it's hitting a wall or just slowly fading?",
        options: [
          { label: "Hits a wall/rev limiter feeling", nextId: "diag-rev-limit" },
          { label: "Slowly fades/four-strokes", nextId: "diag-rich-high" },
          { label: "Gets hot and loses power", nextId: "diag-heat-related" },
        ],
      },
      {
        id: "diag-rev-limit",
        type: "diagnosis",
        title: "Ignition Breakdown at High RPM",
        diagnosis: {
          problem: "Ignition can't keep up at high RPM",
          solution:
            "Common with points ignition or weak coils. 1) Check and set points gap, 2) Replace condenser - they fail silently, 3) Test/replace ignition coil, 4) Consider upgrading to CDI if available for your bike.",
          difficulty: "moderate",
          parts: ["Condenser", "Ignition coil", "CDI kit (upgrade option)"],
          tips: [
            "Condensers often cause high-RPM issues before failing completely",
            "CDI conversions eliminate points maintenance",
            "Make sure plug gap isn't too wide",
          ],
        },
      },
      {
        id: "diag-rich-high",
        type: "diagnosis",
        title: "Rich at High RPM",
        diagnosis: {
          problem: "Too much fuel at wide open throttle",
          solution:
            "Main jet is too large. 1) Go down one main jet size at a time, 2) Check plug color after a WOT run (should be tan/light brown, not black), 3) Make sure air filter isn't over-oiled or clogged.",
          difficulty: "moderate",
          parts: ["Main jets (various sizes)"],
          tips: [
            "Do plug chops - WOT, kill engine, coast to stop, read plug",
            "Rich = black sooty plug, Lean = white/gray plug",
            "It's safer to be slightly rich than lean",
          ],
        },
      },
      {
        id: "diag-heat-related",
        type: "diagnosis",
        title: "Heat-Related Power Loss",
        diagnosis: {
          problem: "Engine overheating causing power loss",
          solution:
            "Could be running too lean (generating excess heat) or cooling issues. 1) Check jetting - lean conditions cause overheating, 2) Clean cooling fins thoroughly, 3) Check for exhaust restrictions, 4) Verify ignition timing isn't too advanced.",
          difficulty: "advanced",
          parts: ["Main jet (possibly larger)", "Head gasket"],
          tips: [
            "2-strokes run hot - that's normal, but loss of power isn't",
            "Seized engines are usually from lean conditions",
            "Watch for signs of detonation (pinging sound)",
          ],
        },
      },
    ],
  },
  {
    id: "transmission",
    name: "Transmission Issues",
    icon: "⚙️",
    description: "Variator, clutch, or weird noises from the drivetrain.",
    startNodeId: "trans-1",
    nodes: [
      {
        id: "trans-1",
        type: "question",
        title: "What's the symptom?",
        description: "Describe what's happening with your transmission.",
        options: [
          { label: "Won't engage/move when I give it gas", nextId: "trans-2" },
          { label: "Slipping - high revs, slow acceleration", nextId: "diag-clutch-slip" },
          { label: "Grinding or clicking noises", nextId: "diag-trans-noise" },
          { label: "Stuck in one gear/ratio", nextId: "diag-variator-stuck" },
        ],
      },
      {
        id: "trans-2",
        type: "question",
        title: "Does the engine rev freely?",
        options: [
          { label: "Yes, revs but no movement", nextId: "diag-clutch-engage" },
          { label: "No, engine bogs when in gear", nextId: "diag-clutch-drag" },
        ],
      },
      {
        id: "diag-clutch-engage",
        type: "diagnosis",
        title: "Clutch Won't Engage",
        diagnosis: {
          problem: "Clutch isn't grabbing to transfer power",
          solution:
            "For centrifugal clutches: 1) Check clutch springs - they may be weak or broken, 2) Inspect clutch shoes for glazing or wear, 3) Clean clutch bell with brake cleaner - oil contamination prevents grabbing, 4) Check engagement RPM - may need stiffer springs.",
          difficulty: "moderate",
          parts: ["Clutch springs", "Clutch shoes", "Clutch bell (if scored)"],
          tips: [
            "Never get oil on clutch components",
            "Sand glazed shoes lightly with coarse sandpaper",
            "Spring stiffness determines engagement RPM",
          ],
        },
      },
      {
        id: "diag-clutch-drag",
        type: "diagnosis",
        title: "Clutch Dragging",
        diagnosis: {
          problem: "Clutch is engaging at idle, making bike hard to start/stop",
          solution:
            "Clutch is engaging too early. 1) Springs may be too stiff, 2) Shoes may be worn and hanging up, 3) Clutch bell may be warped or damaged, 4) Try lighter springs for higher engagement RPM.",
          difficulty: "moderate",
          parts: ["Clutch springs (lighter)", "Clutch shoes"],
          tips: [
            "Lighter springs = higher engagement RPM",
            "Check for bent parts or debris in clutch housing",
          ],
        },
      },
      {
        id: "diag-clutch-slip",
        type: "diagnosis",
        title: "Clutch Slipping",
        diagnosis: {
          problem: "Clutch can't hold power, especially under load",
          solution:
            "Clutch material is worn or contaminated. 1) Replace clutch shoes, 2) Clean or replace clutch bell, 3) Check for oil contamination (bad seal), 4) Stiffer springs can help marginally but won't fix worn material.",
          difficulty: "moderate",
          parts: ["Clutch shoes", "Clutch bell", "Crankshaft seal (if leaking)"],
          tips: [
            "Slipping generates heat which makes it worse",
            "Oil on clutch = find and fix the leak",
            "Performance builds often need upgraded clutch",
          ],
        },
      },
      {
        id: "diag-trans-noise",
        type: "diagnosis",
        title: "Transmission Noise",
        diagnosis: {
          problem: "Grinding, clicking, or knocking from transmission area",
          solution:
            "Could be several things: 1) Check variator rollers for flat spots, 2) Inspect belt for wear, cracks, or missing chunks, 3) Look for loose or worn variator components, 4) Bearing failure in clutch or variator, 5) Check that nothing is rubbing inside the case.",
          difficulty: "advanced",
          parts: ["Variator rollers", "Drive belt", "Bearings"],
          tips: [
            "Remove belt cover and inspect while running (carefully!)",
            "Metal shavings = something is grinding where it shouldn't",
            "Clicking often indicates flat-spotted rollers",
          ],
        },
      },
      {
        id: "diag-variator-stuck",
        type: "diagnosis",
        title: "Variator Not Shifting",
        diagnosis: {
          problem: "CVT stuck in one ratio",
          solution:
            "Variator isn't changing ratios properly. 1) Check roller wear - flat spots prevent smooth shifting, 2) Clean variator faces - glazing causes sticking, 3) Inspect variator ramp plate for wear, 4) Check belt width - worn belt won't shift properly, 5) Lubricate variator post (dry lube only!).",
          difficulty: "advanced",
          parts: ["Variator rollers", "Drive belt", "Variator ramp plate"],
          tips: [
            "Different roller weights change shift points",
            "Heavier rollers = shifts earlier, lighter = revs higher before shifting",
            "Belt width affects ratio range",
          ],
        },
      },
    ],
  },
  {
    id: "leaks",
    name: "Leaks",
    icon: "💧",
    description: "Oil, gas, or mystery fluids appearing where they shouldn't.",
    startNodeId: "leak-1",
    nodes: [
      {
        id: "leak-1",
        type: "question",
        title: "What's leaking?",
        description: "What does the fluid look like?",
        options: [
          { label: "Clear/yellowish - smells like gas", nextId: "leak-fuel" },
          { label: "Oily/dark - smells like 2-stroke", nextId: "leak-oil" },
          { label: "Brownish - transmission oil", nextId: "leak-trans" },
        ],
      },
      {
        id: "leak-fuel",
        type: "question",
        title: "Where is the gas coming from?",
        options: [
          { label: "Carburetor overflow", nextId: "diag-carb-overflow" },
          { label: "Fuel line or petcock", nextId: "diag-fuel-line-leak" },
          { label: "Gas tank", nextId: "diag-tank-leak" },
        ],
      },
      {
        id: "diag-carb-overflow",
        type: "diagnosis",
        title: "Carburetor Overflow",
        diagnosis: {
          problem: "Fuel overflowing from carburetor",
          solution:
            "Float valve isn't shutting off fuel. 1) Check float level - adjust to spec, 2) Inspect float needle and seat for wear/debris, 3) Replace float needle if worn, 4) Check that float isn't cracked or fuel-logged, 5) Clean carb thoroughly - debris prevents needle seating.",
          difficulty: "moderate",
          parts: ["Float needle", "Float (if damaged)", "Carb rebuild kit"],
          tips: [
            "Stuck floats are often just dirty - try tapping the bowl",
            "Float height affects fuel level - measure carefully",
            "A sinking (fuel-logged) float causes constant overflow",
          ],
        },
      },
      {
        id: "diag-fuel-line-leak",
        type: "diagnosis",
        title: "Fuel Line or Petcock Leak",
        diagnosis: {
          problem: "Fuel leaking from lines or petcock",
          solution:
            "1) Replace cracked or hardened fuel lines, 2) Check hose clamps are tight, 3) Rebuild or replace leaking petcock, 4) Inspect fuel filter connections.",
          difficulty: "easy",
          parts: ["Fuel line", "Hose clamps", "Petcock rebuild kit"],
          tips: [
            "Use fuel-rated line only - regular hose degrades",
            "Replace lines every few years as preventive maintenance",
            "Always turn petcock off when parked",
          ],
        },
      },
      {
        id: "diag-tank-leak",
        type: "diagnosis",
        title: "Gas Tank Leak",
        diagnosis: {
          problem: "Fuel tank is leaking",
          solution:
            "Depends on severity: 1) Pinhole leaks can be sealed with tank sealant (like Kreem or POR-15), 2) Cracked petcock mount may need welding or tank replacement, 3) Rust holes indicate tank needs sealing treatment inside.",
          difficulty: "advanced",
          parts: ["Tank sealant kit", "Replacement tank (if severe)"],
          tips: [
            "Always drain and dry tank before any repair",
            "Tank sealers require thorough surface prep",
            "For vintage tanks, sometimes a replacement is easier",
          ],
        },
      },
      {
        id: "leak-oil",
        type: "question",
        title: "Where is the oil coming from?",
        options: [
          { label: "Around the cylinder/head", nextId: "diag-head-leak" },
          { label: "Bottom of engine/crankcase", nextId: "diag-crank-seal" },
          { label: "Exhaust dripping", nextId: "diag-exhaust-oil" },
        ],
      },
      {
        id: "diag-head-leak",
        type: "diagnosis",
        title: "Head/Cylinder Leak",
        diagnosis: {
          problem: "Oil/fuel mixture leaking from cylinder or head area",
          solution:
            "Gasket failure. 1) Retorque head bolts to spec (in proper pattern), 2) If still leaking, replace head gasket, 3) Check for warped head surface with a straight edge, 4) Inspect cylinder base gasket as well.",
          difficulty: "moderate",
          parts: ["Head gasket", "Base gasket", "Torque wrench"],
          tips: [
            "Always torque in a cross pattern",
            "New gaskets often need re-torquing after heat cycles",
            "Surface prep is key - clean all old gasket material",
          ],
        },
      },
      {
        id: "diag-crank-seal",
        type: "diagnosis",
        title: "Crankshaft Seal Leak",
        diagnosis: {
          problem: "Oil leaking from crankcase seals",
          solution:
            "Crankshaft seals have worn out. 1) Identify which side is leaking (clutch or flywheel side), 2) Remove side cover or flywheel to access seal, 3) Carefully pry out old seal, 4) Press in new seal (use proper driver), 5) This can also cause air leaks affecting performance!",
          difficulty: "advanced",
          parts: ["Crankshaft seals (both sides recommended)", "Seal driver"],
          tips: [
            "Leaking seals cause both oil loss AND air leaks",
            "Install seals with lip facing toward crankcase",
            "While you're in there, do both seals",
          ],
        },
      },
      {
        id: "diag-exhaust-oil",
        type: "diagnosis",
        title: "Oil from Exhaust",
        diagnosis: {
          problem: "Oil dripping from exhaust pipe",
          solution:
            "This is usually normal! 2-strokes burn oil as part of operation, and some collects in the pipe. If excessive: 1) Check premix ratio - too much oil causes this, 2) Inspect piston rings for wear, 3) Check that jetting isn't way too rich.",
          difficulty: "easy",
          tips: [
            "Some exhaust oil is normal for 2-strokes",
            "Excessive oil usually means you're running too much premix",
            "Old pipes have more buildup - consider cleaning with torch",
          ],
        },
      },
      {
        id: "leak-trans",
        type: "diagnosis",
        title: "Transmission Oil Leak",
        diagnosis: {
          problem: "Transmission fluid leaking from gearbox",
          solution:
            "Transmission case seal or gasket failure. 1) Check transmission fill level - top up if low, 2) Identify leak location, 3) Replace gasket or seal as needed, 4) Check for cracked cases (rare but possible).",
          difficulty: "moderate",
          parts: ["Transmission oil", "Case gasket", "Output shaft seal"],
          tips: [
            "Use correct transmission oil weight for your bike",
            "Some designs are separate from engine, some share oil",
            "Check drain plug washer - common leak source",
          ],
        },
      },
    ],
  },
];

export function findCategoryById(id: string): TroubleshootingCategory | undefined {
  return troubleshootingCategories.find((cat) => cat.id === id);
}

export function findNodeById(category: TroubleshootingCategory, nodeId: string): TroubleshootingNode | undefined {
  return category.nodes.find((node) => node.id === nodeId);
}
