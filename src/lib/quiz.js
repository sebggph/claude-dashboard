// Quiz questions generated from the cheatsheet: "Which command does X?" with
// four choices from the same section (so wrong answers are plausible).

/** Small seeded random generator, so a round can be reproduced (and tested). */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param sections cheatsheet sections ({ id, items: [{ cmd, desc, why, doc }] })
 * @param opts { count, section ('all' or an id), seed }
 * @returns [{ item, sectionId, choices: [cmd...], answer: index }]
 */
export function makeQuiz(sections, { count = 10, section = 'all', seed = Date.now() } = {}) {
  const rand = rng(seed);
  const pool = sections.flatMap((s) => s.items.map((item) => ({ item, sectionId: s.id })));
  const picked = shuffle(section === 'all' ? pool : pool.filter((p) => p.sectionId === section), rand).slice(0, count);
  return picked.map(({ item, sectionId }) => {
    // Distractors: same section first, then anywhere; never the same command.
    const same = pool.filter((p) => p.sectionId === sectionId && p.item.cmd !== item.cmd).map((p) => p.item.cmd);
    const other = pool.filter((p) => p.sectionId !== sectionId && p.item.cmd !== item.cmd).map((p) => p.item.cmd);
    const wrong = [...new Set([...shuffle(same, rand), ...shuffle(other, rand)])].slice(0, 3);
    const choices = shuffle([item.cmd, ...wrong], rand);
    return { item, sectionId, choices, answer: choices.indexOf(item.cmd) };
  });
}
