import { Comment, SnoowrapOptions } from "snoowrap";
import { ResponseTypes, TriggerPhrase } from "./misc";

export interface AutoSnooOptions {
  debug?: boolean;
  subreddits: string | string[];
  snoowrapOpts: SnoowrapOptions;
  listeners: { [name: string]: ListenerOptions };
}

export interface ListenerOptions {
  header?: string;
  footer?: string;
  cooldown?: number;
  customPredicates?: { (comment: Comment): Promise<boolean> }[];
  responseType?: ResponseTypes;
  triggerPhrase: TriggerPhrase;
  triggerCaseSensitive?: boolean;
  corpus?: string[];
  func?(comment: Comment): Promise<string>;
}

export interface MergedListenerOptions extends ListenerOptions {
  name: string;
  initTime: Date;
  botUsername?: string; // non-existence is checked at runtime
  debug?: boolean;
  corpus?: string[];
  func?(comment: Comment): Promise<string>;
}

export interface CorpusOptions extends MergedListenerOptions {
  corpus: string[];
}

export interface FunctionOptions extends MergedListenerOptions {
  func(comment: Comment): Promise<string>;
}
