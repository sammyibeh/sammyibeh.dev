/* The home hero's "Hello, my name is" cycle. Precomposed (NFC) strings, since typing slices by code unit. */
// Key languages: about 3× as likely as the others. English always opens.
export const KEY = ['Hello, my name is', 'Hallo, ich heiße', 'Hola, mi nombre es', "Bonjour, je m'appelle", 'Olá, meu nome é', 'Привет, меня зовут', '你好，我的名字是', 'こんにちは、私の名前は'];
export const OTHERS = ['Ndewo, aha m bụ', 'Ciao, mi chiamo', 'Báwo ni, orúkọ mi ni', 'Habari, jina langu ni', 'Sannu, sunana', '안녕하세요, 제 이름은', 'How far, my name na', 'नमस्ते, मेरा नाम है'];
const WEIGHT = 3.8; // per-pick weight for KEY; skipping recent phrases trims it to ~3× as often in practice (see test)
const RECENT = 3; // none of the last few phrases come back straight away

/** Returns next(): English first, then weighted random picks that skip the last RECENT phrases. rnd is injectable for tests. */
export function greeter(rnd = Math.random) {
  const all = [...KEY, ...OTHERS], recent = [], w = p => (KEY.includes(p) ? WEIGHT : 1);
  return () => {
    const pool = recent.length ? all.filter(p => !recent.includes(p)) : [KEY[0]];
    let r = rnd() * pool.reduce((a, p) => a + w(p), 0);
    const pick = pool.find(p => (r -= w(p)) < 0) ?? pool.at(-1);
    recent.push(pick); if (recent.length > RECENT) recent.shift();
    return pick;
  };
}
