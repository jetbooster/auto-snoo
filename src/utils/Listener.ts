import { Comment } from "snoowrap";
import { containsTriggerWord } from "./redditUtils";
import { ResponseTypes } from "../types/misc";
import { ListenerInterface } from "../types/listeners";
import {
  CorpusOptions,
  FunctionOptions,
  MergedListenerOptions
} from "../types/configObjects";

export class BaseListener implements ListenerInterface {
  public name: string;
  public initTime: Date;
  public debug: boolean;
  public header: string;
  public footer: string;
  public cooldown: number;
  public customPredicates?: { (comment: Comment): Promise<boolean> }[];
  public responseType: ResponseTypes;
  public botUsername: string;
  public lastCommented: Date | null;
  public triggerPhrase: (string | RegExp)[] | string | RegExp;
  public triggerCaseSensitive: boolean;

  public constructor(options: MergedListenerOptions) {
    this.name = options.name;
    this.initTime = options.initTime;
    this.debug = options.debug || false;
    this.header = options.header || "";
    this.footer = options.footer || "";
    // 0 is falsy, 'options.cooldown || 10' would prevent setting a timout of zero
    this.cooldown =
      options.cooldown || typeof options.cooldown === "number"
        ? options.cooldown
        : 10;
    this.customPredicates = options.customPredicates;
    this.responseType = options.responseType || ResponseTypes.random;

    if (!options.botUsername)
      throw Error(
        `Listener:${this.name} - Listeners must know username of bot to prevent replying to itself`
      );
    this.botUsername = options.botUsername;

    this.lastCommented = null;

    if (!options.triggerPhrase)
      throw Error(
        `Listener:${this.name} - Listeners require a provided trigger phrase or array of triggerphrases`
      );
    this.triggerPhrase = options.triggerPhrase;
    this.triggerCaseSensitive = options.triggerCaseSensitive || false;
  }

  public async shouldComment(comment: Comment): Promise<boolean> {
    if (
      this.lastCommented &&
      !(Date.now() >= this.lastCommented.valueOf() + 1000 * 60 * this.cooldown)
    ) {
      // cooldown not over
      // perform cooldown check first as it requires no querying of the comment content
      if (this.debug) {
        console.log(
          `Listener:${
            this.name
            // eslint-disable-next-line max-len
          } - Not commenting because still on cooldown. Now: ${Date.now()}, lastCommented+cooldown: ${this.lastCommented.valueOf() +
            1000 * 60 * this.cooldown}`
        );
      }
      return false;
    }
    if ((await comment.created_utc) * 1000 < this.initTime.valueOf()) {
      // comment was made before this instance of bot came online. Ignore to avoid double replying older messages
      if (this.debug) {
        console.log(
          `Listener:${this.name} - Not commenting because Comment was in the past`
        );
      }
      return false;
    }
    // @ts-ignore
    const authorName = await (await comment.author).name;
    if (authorName === this.botUsername) {
      // Do not reply to comments made by the bot, to avoid potential for infinite loops
      if (this.debug) {
        console.log(
          `Listener:${this.name} - Not commenting because would be reply to self`
        );
      }
      return false;
    }
    const triggerHit = await containsTriggerWord(
      comment,
      this.triggerPhrase,
      this.triggerCaseSensitive
    );
    if (!triggerHit) {
      if (this.debug) {
        console.log(
          `Listener:${this.name} - Not commenting because no trigger word`
        );
      }
      return false;
    }

    if (this.customPredicates) {
      // If custom predicates have been provided, make sure all of them pass
      const results = await Promise.all(
        this.customPredicates.map(
          (predicate): Promise<boolean> => predicate(comment)
        )
      );
      if (this.debug) {
        // TODO add some sort of logger
        console.log(
          `Listener:${
            this.name
          } - Reached custom predicates. Result: ${JSON.stringify(results)}`
        );
      }
      return results.every((result): boolean => result);
    }
    return true;
  }

  public async generateReply(comment: Comment): Promise<string> {
    return `Generic listener class should be extended to implement generateReply ${comment.id}`;
  }

  public async run(comment: Comment): Promise<void> {
    if (this.debug) {
      console.log(`Listener:${this.name} - Running listener`);
    }
    if (await this.shouldComment(comment)) {
      console.log(`Listener:${this.name} - Sucessfully triggered, responding`);
      comment.reply(await this.generateReply(comment));
      this.lastCommented = new Date();
    }
  }
}

export class RandomListener extends BaseListener implements RandomListener {
  protected corpus: string[];
  public constructor(options: CorpusOptions) {
    super(options);
    if (!options.corpus) {
      throw Error(
        `Listener:${this.name} - Random and sequential Listeners require a provided corpus attribute`
      );
    }
    this.corpus = options.corpus;
  }
  public async generateReply(): Promise<string> {
    const index = Math.floor(this.corpus.length * Math.random());
    const commentBody = this.corpus[index];
    const fullComment = `${this.header}${commentBody}${this.footer}`;
    if (this.debug) {
      console.log(
        `Listener:${this.name} - Generated reply comment: body: ${commentBody}`
      );
    }
    return fullComment;
  }
}

export class SequentialListener extends BaseListener
  implements SequentialListener {
  protected index: number;
  protected corpus: string[];
  public constructor(options: CorpusOptions) {
    super(options);
    if (!options.corpus) {
      throw Error(
        `Listener:${this.name} - Random and sequential Listeners require a provided corpus attribute`
      );
    }
    this.corpus = options.corpus;
    this.index = 0;
  }
  public async generateReply(): Promise<string> {
    if (this.index > this.corpus.length - 1) {
      this.index %= this.corpus.length;
    }
    const commentBody = this.corpus[this.index];
    const fullComment = `${this.header}${commentBody}${this.footer}`;
    if (this.debug) {
      console.log(
        `Listener:${this.name} - Generated reply comment: body: ${commentBody}`
      );
    }
    this.index += 1;
    return fullComment;
  }
}

export class FunctionListener extends BaseListener implements FunctionListener {
  protected func: { (comment: Comment): Promise<string> };
  public constructor(options: FunctionOptions) {
    super(options);
    if (!options.func) {
      console.log("throwing");
      throw Error(
        `Listener:${this.name} - Function Listeners require a provided function attribute`
      );
    }
    this.func = options.func;
  }
  public async generateReply(comment: Comment): Promise<string> {
    const commentBody = await this.func(comment);
    const fullComment = `${this.header}${commentBody}${this.footer}`;
    if (this.debug) {
      console.log(
        `Listener:${this.name} - Generated reply comment: body: ${commentBody}`
      );
    }
    return fullComment;
  }
}

export function Listener(
  options: MergedListenerOptions
): RandomListener | SequentialListener | FunctionListener {
  let clazz;
  if (!options.responseType) {
    clazz = new RandomListener(options as CorpusOptions);
  } else {
    switch (options.responseType) {
      case ResponseTypes.random: {
        clazz = new RandomListener(options as CorpusOptions);
        break;
      }
      case ResponseTypes.sequential: {
        clazz = new SequentialListener(options as CorpusOptions);
        break;
      }
      case ResponseTypes.function: {
        clazz = new FunctionListener(options as FunctionOptions);
        break;
      }
      default: {
        throw Error(
          `Listener:${
            options.name
          } - Unrecognised Listener Type. Valid types are ${Object.values(
            ResponseTypes
          )}`
        );
      }
    }
  }
  return clazz;
}

export default Listener;
