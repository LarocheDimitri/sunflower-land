import Decimal from "decimal.js-light";
import { STONE_RECOVERY_TIME } from "features/game/lib/constants";
import { trackActivity } from "features/game/types/bumpkinActivity";
import { BumpkinSkillName } from "features/game/types/bumpkinSkills";
import cloneDeep from "lodash.clonedeep";
import { Collectibles, GameState, Rock } from "../../types/game";
import { isCollectibleActive } from "features/game/lib/collectibleBuilt";

export type LandExpansionStoneMineAction = {
  type: "stoneRock.mined";
  index: number;
};

type Options = {
  state: Readonly<GameState>;
  action: LandExpansionStoneMineAction;
  createdAt?: number;
};

type GetMinedAtArgs = {
  skills: Partial<Record<BumpkinSkillName, number>>;
  createdAt: number;
  collectibles: Collectibles;
};

export function canMine(rock: Rock, now: number = Date.now()) {
  const recoveryTime = STONE_RECOVERY_TIME;
  return now - rock.stone.minedAt > recoveryTime * 1000;
}

/**
 * Set a mined in the past to make it replenish faster
 */
export function getMinedAt({
  skills,
  createdAt,
  collectibles,
}: GetMinedAtArgs): number {
  let time = createdAt;

  if (skills["Coal Face"]) {
    time -= STONE_RECOVERY_TIME * 0.2 * 1000;
  }

  if (isCollectibleActive("Time Warp Totem", collectibles)) {
    time -= STONE_RECOVERY_TIME * 0.5 * 1000;
  }

  return time;
}

export function mineStone({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  const stateCopy = cloneDeep(state);
  const { stones, bumpkin, collectibles } = stateCopy;
  const rock = stones?.[action.index];

  if (!rock) {
    throw new Error("Stone does not exist");
  }

  if (bumpkin === undefined) {
    throw new Error("You do not have a Bumpkin");
  }

  if (!canMine(rock, createdAt)) {
    throw new Error("Rock is still recovering");
  }

  const toolAmount = stateCopy.inventory["Pickaxe"] || new Decimal(0);

  if (toolAmount.lessThan(1)) {
    throw new Error("No pickaxes left");
  }

  const stoneMined = rock.stone.amount;
  const amountInInventory = stateCopy.inventory.Stone || new Decimal(0);

  rock.stone = {
    minedAt: getMinedAt({
      skills: bumpkin.skills,
      createdAt: Date.now(),
      collectibles,
    }),
    amount: 2,
  };

  stateCopy.inventory.Pickaxe = toolAmount.sub(1);
  stateCopy.inventory.Stone = amountInInventory.add(stoneMined);

  bumpkin.activity = trackActivity("Stone Mined", bumpkin.activity);

  return stateCopy;
}
