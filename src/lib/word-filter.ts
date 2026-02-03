// A list of words to be filtered. This is not an exhaustive list and should be expanded.
// Words related to self-harm, severe insults, and explicit content.
const blockedWords = [
  // self-harm
  "suicide", "kill myself", "kms",
  // slurs (examples, not exhaustive)
  "n-word", // placeholder
  // sexual
  "sex", "porn", 
  // offensive
  "bitch", "slut", "whore"
];

const wordRegex = new RegExp(`\\b(${blockedWords.join('|')})\\b`, 'i');

/**
 * Checks if a message contains any blocked words.
 * @param message The message to check.
 * @returns `true` if the message contains blocked words, `false` otherwise.
 */
export function filterMessage(message: string): boolean {
  return wordRegex.test(message);
}
