// A protocol's farm plan: six concrete steps, each with what it costs and how long it takes.
//
// Every step is derived from the protocol's own record (its category, its chains, its TVL and its
// age), never from a hand-written list of names. The plan never promises an airdrop: a protocol on
// this board records no token, and the plan says so. What it does is put a reader in the position
// the protocol itself would reward if it ever issued one.

import type { SnapshotProtocol } from './model.ts';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A second chain for a repeat visit, or the first one again when there is only one. */
function secondChainOf(p: SnapshotProtocol): string {
  return p.chains.length > 1 ? p.chains[1]! : chainOf(p);
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** Gas for one ordinary transaction on the protocol's main chain, in whole dollars. */
function gasFor(capital: number): number {
  return capital >= 200 ? 10 : 5;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function mainAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Lend $${capital} of USDC on ${name} on ${chain}: deposit it into the lending market and leave the supply earning.`;
  }
  if (c.includes('dex') || c.includes('exchange')) {
    return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the LP position open.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC through ${name} onto ${chain}, then use the bridged funds inside the protocol's own app.`;
  }
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking')) {
    return `Stake $${capital} of the chain's native asset through ${name} and hold the receipt token it issues.`;
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return `Deposit $${capital} of USDC as margin on ${name}, open one small hedged position, and close it after a day.`;
  }
  if (c.includes('prediction')) {
    return `Fund your ${name} account with $${capital} and take one small position in a market you follow.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares it issues.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol.`;
  }
  if (c.includes('rwa')) {
    return `Buy $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  }
  if (c.includes('leveraged farm')) {
    return `Open a $${capital} leveraged farming position on ${name} on ${chain} at the lowest leverage it offers.`;
  }
  if (c.includes('yield')) {
    return `Deposit $${capital} into ${name}'s highest-yield strategy on ${chain} and leave it compounding.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly habit: one small repeat action that keeps the wallet active. */
function weeklyAction(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'top up the supply a little, or borrow and repay a small amount';
  if (c.includes('dex') || c.includes('exchange')) return 'make one small swap through the pool';
  if (c.includes('bridge')) return 'bridge a small amount between two of its chains';
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking')) return 'restake the rewards, or add a small amount to the stake';
  if (c.includes('perpetual') || c.includes('derivative')) return 'open and close one small hedged trade';
  if (c.includes('prediction')) return 'take one small position in a new market';
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return 'add a small amount to the vault, or move between two vaults';
  if (c.includes('stable')) return 'mint or redeem a small amount of the stable asset';
  if (c.includes('rwa')) return 'claim the yield and add a small amount to the holding';
  if (c.includes('insurance')) return 'review the cover and renew it before it lapses';
  if (c.includes('yield')) return 'claim the rewards and redeposit them into the strategy';
  return 'make one small deposit, swap or vote';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(capital);
  const hold = holdDaysFor(age);
  const action = mainAction(p, capital, chain);
  const weekly = weeklyAction(p);
  const multiChain = p.chains.length > 1;
  return [
    {
      text: `Set aside one wallet for this farm alone, fund it with $${capital + gas * 3} in total, and keep its seed phrase offline.`,
      cost: `$${capital + gas * 3} all in, including gas`,
      time: '5 minutes to set up',
    },
    {
      text: action,
      cost: `$${capital} of capital plus about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: multiChain
        ? `Repeat the same position on ${second} once, so the wallet shows activity on more than one of the protocol's chains.`
        : `Come back once a week and ${weekly}, so the wallet stays active across snapshots.`,
      cost: multiChain ? `about $${gas} of gas for the second chain` : `about $${Math.max(2, Math.round(gas / 2))} of gas a week`,
      time: multiChain ? '15 minutes, once' : '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, and ${weekly} each week, so the activity lands in more than one snapshot window.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from its official site; it records no token, so never claim from a link anyone sends you.`,
      cost: 'free to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, so you can repeat the position on the next protocol or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}
