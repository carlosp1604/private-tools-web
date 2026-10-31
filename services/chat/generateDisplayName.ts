const PREFIXES = [
  'Turbo', 'Hiper', 'Mega', 'Ultra', 'Neo', 'Cosmo', 'Astro', 'Nano', 'Giga', 'Quantum', 'Electro', 'Retro',
  'Atomo', 'Solar', 'Lunar', 'Nitro', 'Psico', 'Sonic', 'Volt', 'Zen', 'Ninja', 'Pixel', 'Fractal', 'Nebula',
]

const ANIMALS = [
  'Mantis', 'Panda', 'Koala', 'Puma', 'Gecko', 'Orca', 'Cobra', 'Jaguar', 'Lemur', 'Yak', 'Tapir', 'Coyote',
  'Kiwi', 'Alpaca', 'Llama', 'Dingo', 'Bonobo', 'Quokka', 'Axolotl', 'Tucan', 'Ibis', 'Lori', 'Okapi', 'Ocelot',
]

function pick(words: ReadonlyArray<string>): string {
  const [index = 0] = crypto.getRandomValues(new Uint32Array(1))

  return words[index % words.length] ?? ''
}

/**
 * Comes from the browser and not from the session code or password, because both participants share those and
 * would end up with the same name. The other side only learns it through the encrypted channel
 */
export function generateDisplayName(): string {
  return `${pick(PREFIXES)}${pick(ANIMALS)}`
}
