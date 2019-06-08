export enum ResponseTypes {
  random = "random",
  sequential = "sequential",
  function = "function"
}

export interface BasicComment {
  id: string;
  parent_id: string;
  author: string;
  body: string;
}

export type TriggerPhrase = string | RegExp | (string | RegExp)[];
