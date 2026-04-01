// Sticker mapping based on emotions
// 1=laughing, 2=hearts, 3=shocked, 4=thumbsup, 5=waving, 6=kiss
// 7=bigsmile, 8=happy, 9=skeptic, 10=excited, 11=thinking, 12=crying

const CORRECT_STICKERS = [4, 7, 1, 8];
const WRONG_STICKERS = [12, 3, 11];
const GREAT_RESULT_STICKERS = [10, 2, 7];
const GOOD_RESULT_STICKERS = [5, 6, 8];
const BAD_RESULT_STICKERS = [12, 9, 3];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getCorrectSticker() {
  return `/stickers/${randomFrom(CORRECT_STICKERS)}.webp`;
}

export function getWrongSticker() {
  return `/stickers/${randomFrom(WRONG_STICKERS)}.webp`;
}

export function getResultSticker(score, total) {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return `/stickers/${randomFrom(GREAT_RESULT_STICKERS)}.webp`;
  if (pct >= 0.5) return `/stickers/${randomFrom(GOOD_RESULT_STICKERS)}.webp`;
  return `/stickers/${randomFrom(BAD_RESULT_STICKERS)}.webp`;
}

export function getResultMessage(score, total, t) {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return t.perfect;
  if (pct >= 0.5) return t.good;
  return t.keepTrying;
}
