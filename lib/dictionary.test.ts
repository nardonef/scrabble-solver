import { describe, it, expect } from "vitest";
import { buildTrie, loadDictionary, isValidWord, hasPrefix } from "./dictionary";

describe("Trie (via buildTrie)", () => {
  const trie = buildTrie(["CAT", "CATS", "DOG"]);

  it("recognizes inserted words", () => {
    expect(trie.isWord("CAT")).toBe(true);
    expect(trie.isWord("CATS")).toBe(true);
    expect(trie.isWord("DOG")).toBe(true);
  });

  it("rejects partial or unknown words", () => {
    expect(trie.isWord("CA")).toBe(false);
    expect(trie.isWord("CATSS")).toBe(false);
    expect(trie.isWord("DOGGY")).toBe(false);
  });

  it("reports valid prefixes distinctly from full words", () => {
    expect(trie.hasPrefix("CA")).toBe(true);
    expect(trie.hasPrefix("CAT")).toBe(true);
    expect(trie.hasPrefix("DOB")).toBe(false);
  });
});

describe("bundled dictionary", () => {
  it("loads the real word list and validates known words", () => {
    expect(isValidWord("house")).toBe(true);
    expect(isValidWord("QUIZ")).toBe(true);
    expect(isValidWord("zzzzqqqq")).toBe(false);
  });

  it("caches the loaded trie across calls", () => {
    const first = loadDictionary();
    const second = loadDictionary();
    expect(first).toBe(second);
  });
});
