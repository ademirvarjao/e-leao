import {lc123, lc214} from '../lib/legal';

export function LawLink({article, simple = false}: {article: string; simple?: boolean}) {
  return <a href={simple ? lc123 : lc214} target="_blank" rel="noreferrer">{simple ? 'LC 123/2006' : 'LC 214/2025'}{article && `, ${article}`}</a>;
}
