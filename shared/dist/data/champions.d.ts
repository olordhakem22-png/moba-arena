/**
 * Champion Data - All 8 champions with abilities
 * Used by both client and server
 */
import type { Champion, ChampionStats, Ability } from '../types/champion.js';
export declare const CHAMPION_DATA: Record<string, Champion>;
export declare function getChampion(id: string): Champion | undefined;
export declare function getAllChampionIds(): string[];
export declare function getChampionStatsAtLevel(championId: string, level: number): ChampionStats | undefined;
export declare function getAbility(championId: string, key: 'Q' | 'W' | 'E' | 'R'): Ability | undefined;
//# sourceMappingURL=champions.d.ts.map