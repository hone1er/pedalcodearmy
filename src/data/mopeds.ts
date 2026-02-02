export type MopedSetup = {
  kit?: string;
  carb?: string;
  pipe?: string;
  variator?: string;
  otherMods?: string;
};

export type Moped = {
  id: string;
  name: string;
  make: string;
  model: string;
  owner: string;
  ownerInstagram?: string;
  ownerImage?: string;
  country?: string;
  image: string;
  setup?: MopedSetup;
};

export const mopeds: Moped[] = [
  // Joe Villavicencio's mopeds
  {
    id: "joe-magnum-ii",
    name: "Magnum II",
    make: "Puch",
    model: "Magnum II",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/magnum.JPG",
    setup: {
      kit: "Puch Treat Kit Party - 70cc TCCD kit / Custom cut head",
      carb: "Dellorto 15.15 SHA",
      pipe: "Black Pipe",
    },
  },
  {
    id: "joe-derbi-variant-tt",
    name: "Derbi Variant TT",
    make: "Derbi",
    model: "Variant TT",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/derbi.jpeg",
    setup: {
      kit: "Stock",
      carb: "Dellorto 15.15 SHA",
      pipe: "Tecno Boss",
      variator: "Stock",
    },
  },
  {
    id: "joe-derbi-sl-79",
    name: "Derbi Variant SL '79",
    make: "Derbi",
    model: "Variant SL",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/blackderbisl.jpeg",
    setup: {
      kit: "Autisa 65cc",
      carb: "Dellorto 15.15 SHA",
      pipe: "Estoril",
      variator: "Hobbit X-treme clutch bell w/ TJT",
    },
  },
  {
    id: "joe-derbi-sl-86",
    name: "Derbi Variant SL '86",
    make: "Derbi",
    model: "Variant SL",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/whitederbisl.jpeg",
    setup: {
      kit: "Stock",
      carb: "Dellorto 15.15 SHA",
      pipe: "Tecno Boss",
      variator: "Stock",
    },
  },
  {
    id: "joe-derbi-rd50",
    name: "Derbi RD 50",
    make: "Derbi",
    model: "RD 50",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/rd50.jpeg",
    setup: {
      kit: "Metrakit 65cc",
      carb: "Dellorto 15.15 SHA",
      pipe: "Stock",
      variator: "TJT",
    },
  },
  {
    id: "joe-maxi-n",
    name: "Maxi N",
    make: "Puch",
    model: "Maxi N",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/maxi_n.JPG",
    setup: {
      kit: "Mystery Kit",
      carb: "Dellorto 15.15 SHA",
      pipe: "Tecno Boss",
    },
  },
  {
    id: "joe-maxi-yellow",
    name: "Little Yellow Maxi",
    make: "Puch",
    model: "Maxi",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/maxi.JPG",
    setup: {
      kit: "Stock",
      carb: "Dellorto 14 SHA",
      pipe: "Tecno Boss",
    },
  },
  {
    id: "joe-hobbit-red",
    name: "Hobbit PA 50I",
    make: "Honda",
    model: "Hobbit PA 50I",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/redracehobbit.jpeg",
    setup: {
      kit: "Polini 70cc",
      carb: "Mikuni VM20",
      pipe: "Custom Crank Pipes",
      variator: "Treats",
    },
  },
  {
    id: "joe-hobbit-yellow",
    name: "Hobbit PA 50II",
    make: "Honda",
    model: "Hobbit PA 50II",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/yellowhobbit.jpeg",
    setup: {
      kit: "DR kit",
      carb: "Stock clone",
      pipe: "Stock pipe",
      variator: "Treats",
    },
  },
  {
    id: "joe-hobbit-rip",
    name: "Hobbit PA 50II (CRASHED - RIP)",
    make: "Honda",
    model: "Hobbit PA 50II",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/hobbit.jpeg",
    setup: {
      kit: "Stocko shocko",
      carb: "Mikuni VM20",
      pipe: "Proma",
      variator: "Treats Prototype",
    },
  },
  {
    id: "joe-garelli-ssxl",
    name: "Garelli SSXL LTD",
    make: "Garelli",
    model: "SSXL LTD",
    owner: "Joe Villavicencio",
    ownerInstagram: "hone1er",
    ownerImage: "/images/hone.jpeg",
    image: "/images/honesMopeds/ssxl.jpeg",
  },

  // Kyle Militante's mopeds
  {
    id: "kyle-magnum",
    name: "Magnum",
    make: "Puch",
    model: "Magnum",
    owner: "Kyle Militante",
    ownerInstagram: "milileaks",
    ownerImage: "/images/mili.jpeg",
    image: "/images/milisMopeds/magnum.JPG",
  },
  {
    id: "kyle-pinto",
    name: "Pinto",
    make: "Puch",
    model: "Pinto",
    owner: "Kyle Militante",
    ownerInstagram: "milileaks",
    ownerImage: "/images/mili.jpeg",
    image: "/images/milisMopeds/pinto.JPG",
  },
  {
    id: "kyle-tomos",
    name: "Tomos",
    make: "Tomos",
    model: "Tomos",
    owner: "Kyle Militante",
    ownerInstagram: "milileaks",
    ownerImage: "/images/mili.jpeg",
    image: "/images/milisMopeds/tomos.JPG",
  },

  // Joshua Willing's mopeds
  {
    id: "joshua-maxi",
    name: "Maxi",
    make: "Puch",
    model: "Maxi",
    owner: "Joshua Willing",
    ownerInstagram: "femoresroom",
    ownerImage: "/images/jdub.jpg",
    image: "/images/jdubsMopeds/maxi.JPG",
  },

  // Isabel Muñoz's mopeds
  {
    id: "isabel-hobbit",
    name: "Hobbit",
    make: "Honda",
    model: "Hobbit",
    owner: "Isabel Muñoz",
    ownerInstagram: "isssssabel_m",
    ownerImage: "/images/izzy.jpeg",
    image: "/images/izzysMopeds/redhobbit.jpeg",
  },

  // Alex Baranda's mopeds
  {
    id: "alex-dirt-hobbit",
    name: "Dirt Hobbit",
    make: "Honda",
    model: "Hobbit",
    owner: "Alex Baranda",
    ownerInstagram: "sensifunoner",
    ownerImage: "/images/alex.jpeg",
    image: "/images/alexsMopeds/dirthobbit.jpeg",
  },

  // Lydia Vieyra's mopeds
  {
    id: "lydia-maxi",
    name: "Maxi",
    make: "Puch",
    model: "Maxi",
    owner: "Lydia Vieyra",
    ownerInstagram: "lydia_deets_",
    ownerImage: "/images/lydia.jpeg",
    image: "/images/alexsMopeds/maxi.jpeg",
  },

  // European Division - Driss (France)
  {
    id: "driss-maxi-s",
    name: "Maxi S",
    make: "Puch",
    model: "Maxi S",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/blue_maxi.jpeg",
  },
  {
    id: "driss-maxi-silver",
    name: "Maxi (Silver)",
    make: "Puch",
    model: "Maxi",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/silver_maxi.jpeg",
  },
  {
    id: "driss-maxi-black",
    name: "Maxi (Black)",
    make: "Puch",
    model: "Maxi",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/black_maxi.jpeg",
  },
  {
    id: "driss-maxi-grey",
    name: "Maxi (Grey)",
    make: "Puch",
    model: "Maxi",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/grey_maxi.jpeg",
  },
  {
    id: "driss-magnum-1",
    name: "Puch Magnum",
    make: "Puch",
    model: "Magnum",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/puch_magnum.jpeg",
  },
  {
    id: "driss-magnum-red",
    name: "Puch Magnum (Red)",
    make: "Puch",
    model: "Magnum",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/red_magnum.jpeg",
  },
  {
    id: "driss-x10s",
    name: "X-10s",
    make: "Puch",
    model: "X-10s",
    owner: "Driss",
    ownerInstagram: "driss_blz",
    ownerImage: "/images/euros/driss/driss.jpeg",
    country: "France",
    image: "/images/euros/driss/x_10s.jpeg",
  },

  // European Division - Nils Rösner (Germany)
  {
    id: "nils-ktm-ciao",
    name: "KTM Hobby & Piaggio Ciao",
    make: "KTM/Piaggio",
    model: "Hobby/Ciao",
    owner: "Nils Rösner",
    ownerInstagram: "rosnernils",
    ownerImage: "/images/euros/nils/nils.jpeg",
    country: "Germany",
    image: "/images/euros/nils/ktm_ciao.jpeg",
  },
  {
    id: "nils-zundapp",
    name: "Zündapp Bergsteiger/434",
    make: "Zündapp",
    model: "Bergsteiger/434",
    owner: "Nils Rösner",
    ownerInstagram: "rosnernils",
    ownerImage: "/images/euros/nils/nils.jpeg",
    country: "Germany",
    image: "/images/euros/nils/zundapp.jpeg",
  },
];

// Get unique makes for filtering
export const uniqueMakes = [...new Set(mopeds.map((m) => m.make))].sort();

// Get unique owners
export const uniqueOwners = [...new Set(mopeds.map((m) => m.owner))].sort();

// Get mopeds with setups only
export const mopedWithSetups = mopeds.filter((m) => m.setup);
