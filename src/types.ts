export interface CardData {
  id: string;
  name: string;
  symbol: string;
  image: string;
  details: string;
  stats: {
    no: number;
    speed: number;
    skill: number;
    power: number;
    xp: number;
  };
}

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  uid: string;
  name: string;
  deck: CardData[];
  ready: boolean;
}

export interface GameRoom {
  id: string;
  roomKey: string;
  hostUid: string;
  status: GameStatus;
  players: Player[];
  currentTurn: string;
  comparison?: {
    stat: keyof CardData['stats'];
    startTime: string;
    playerUid: string;
  };
  lastAction?: {
    playerUid: string;
    stat: keyof CardData['stats'];
    value: number;
    result: 'win' | 'lose' | 'draw';
  };
  winner?: string;
  createdAt: any;
}

export interface UserProfile {
  name: string;
  raheeKey: string;
  wins: number;
  losses: number;
}
