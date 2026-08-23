import fs from "fs";
import path from "path";

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    node.isWord = true;
  }

  isWord(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isWord;
  }

  hasPrefix(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  private findNode(str: string): TrieNode | null {
    let node = this.root;
    for (const ch of str) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }
}

export function buildTrie(words: string[]): Trie {
  const trie = new Trie();
  for (const w of words) trie.insert(w.toUpperCase());
  return trie;
}

let cached: Trie | null = null;

export function loadDictionary(): Trie {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "data", "wordlist.txt");
  const raw = fs.readFileSync(filePath, "utf-8");
  const words = raw
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  cached = buildTrie(words);
  return cached;
}

export function isValidWord(word: string): boolean {
  return loadDictionary().isWord(word.toUpperCase());
}

export function hasPrefix(prefix: string): boolean {
  return loadDictionary().hasPrefix(prefix.toUpperCase());
}
