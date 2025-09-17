// final-project-frontend/types/shari.ts
export type ShariRoll = {
  player_id?: string;
  reason?: string;
  d6?: number;
  outcome?: "favorable" | "unfavorable";
};

export type ShariUpdate = {
  characterHurt?: Record<string, boolean | number | string>;
  currentLocation?: string | null;
  previousLocation?: string | null;
  notes?: string;
  inventory?: {
    consumed?: Record<string, (string | { name: string; charges?: number })[]>;
    added?: Record<string, (string | { name: string; charges?: number })[]>;
    charges?: Record<string, Record<string, number>>; // { pid: { itemName: delta } }
  };
  skills?: {
    cooldown?: Record<string, Record<string, number>>;
  };
};

export type ShariBlock = {
  assess?: any[];
  rolls?: ShariRoll[];
  update?: ShariUpdate;
};

export type World = { time?: string; location?: string; notes?: string };

export type PartyEntry = {
  id: string;
  name?: string;
  role?: string;
  sheet?: {
    hp?: number;
    status?: string[];
    stats?: Record<string, number>;
    skills?: string[];
    items?: Array<string | { name: string; charges?: number }>;
    spells?: Array<string | { name: string; charges?: number }>;
  };
};
