import { Comment } from "snoowrap";
import { ResponseTypes, TriggerPhrase } from "./misc";

export interface ListenerInterface {
  name: string;
  initTime: Date;
  debug: boolean;
  header: string;
  footer: string;
  cooldown: number;
  customPredicates?: { (comment: Comment): Promise<boolean> }[];
  readonly responseType: ResponseTypes;
  botUsername: string;
  lastCommented: Date | null;
  triggerPhrase: TriggerPhrase;
  triggerCaseSensitive: boolean;

  shouldComment(comment: Comment): Promise<boolean>;
  generateReply(comment?: Comment): Promise<string>;
  run(comment: Comment): void;
}

export interface CorpusListener extends ListenerInterface {
  corpus: string[];
}

export interface SequentialListener extends CorpusListener {
  index: number;
}

export interface FunctionListener extends ListenerInterface {
  func(comment: Comment): Promise<string>;
}
