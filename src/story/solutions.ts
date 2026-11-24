// Сгенерировано scripts/generate.ts — не править руками.
import type { Cell, Clue } from "../puzzle/engine";

export const SOLUTIONS: Record<string, { pos: Cell[]; clues: Clue[] }> = {
 "baggage": {
  "pos": [
   20,
   1,
   7,
   19,
   13
  ],
  "clues": [
   [
    {
     "t": "zone",
     "z": "K"
    }
   ],
   [
    {
     "t": "adj",
     "k": "M"
    }
   ],
   [
    {
     "t": "zone",
     "z": "P"
    }
   ],
   [
    {
     "t": "adj",
     "k": "O"
    }
   ],
   [
    {
     "t": "adj",
     "k": "H"
    }
   ]
  ]
 },
 "platzkart": {
  "pos": [
   18,
   32,
   16,
   27,
   5,
   7
  ],
  "clues": [
   [
    {
     "t": "adj",
     "k": "V"
    }
   ],
   [
    {
     "t": "adj",
     "k": "O"
    }
   ],
   [
    {
     "t": "zone",
     "z": "2"
    }
   ],
   [
    {
     "t": "adj",
     "k": "K"
    },
    {
     "t": "zone",
     "z": "П"
    }
   ],
   [
    {
     "t": "on",
     "k": "N"
    },
    {
     "t": "zone",
     "z": "2"
    }
   ],
   [
    {
     "t": "adj",
     "k": "N"
    }
   ]
  ]
 },
 "kupe": {
  "pos": [
   7,
   29,
   22,
   33,
   14,
   0
  ],
  "clues": [
   [
    {
     "t": "adj",
     "k": "N"
    },
    {
     "t": "zone",
     "z": "1"
    }
   ],
   [
    {
     "t": "notZone",
     "z": "1"
    }
   ],
   [
    {
     "t": "adj",
     "k": "Z"
    }
   ],
   [
    {
     "t": "notZone",
     "z": "П"
    }
   ],
   [
    {
     "t": "adj",
     "k": "N"
    }
   ],
   [
    {
     "t": "on",
     "k": "N"
    },
    {
     "t": "zone",
     "z": "1"
    }
   ]
  ]
 },
 "restaurant": {
  "pos": [
   30,
   20,
   16,
   5,
   7,
   27
  ],
  "clues": [
   [
    {
     "t": "window"
    }
   ],
   [
    {
     "t": "notZone",
     "z": "В"
    }
   ],
   [
    {
     "t": "adj",
     "k": "T"
    },
    {
     "t": "zone",
     "z": "З"
    }
   ],
   [
    {
     "t": "adj",
     "k": "C"
    },
    {
     "t": "window"
    }
   ],
   [
    {
     "t": "on",
     "k": "X"
    }
   ],
   [
    {
     "t": "zone",
     "z": "К"
    }
   ]
  ]
 },
 "locomotive": {
  "pos": [
   41,
   15,
   5,
   21,
   11,
   44,
   31
  ],
  "clues": [
   [
    {
     "t": "adj",
     "k": "Y"
    },
    {
     "t": "zone",
     "z": "У"
    }
   ],
   [
    {
     "t": "notAdj",
     "k": "F"
    }
   ],
   [
    {
     "t": "adj",
     "k": "D"
    },
    {
     "t": "window"
    }
   ],
   [
    {
     "t": "notZone",
     "z": "К"
    }
   ],
   [
    {
     "t": "adj",
     "k": "D"
    },
    {
     "t": "zone",
     "z": "Т"
    }
   ],
   [
    {
     "t": "adj",
     "k": "A"
    },
    {
     "t": "window"
    }
   ],
   [
    {
     "t": "adj",
     "k": "D"
    }
   ]
  ]
 }
};
