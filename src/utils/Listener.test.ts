import { Comment } from "snoowrap";

import Listener, { RandomListener } from "./Listener";
import utils from "./redditUtils";
import { ResponseTypes } from "../types/misc";
import { SequentialListener, FunctionListener } from "../types/listeners";

const sleep = (millis: number): Promise<void> =>
  new Promise((res): unknown => setTimeout(res, millis));

const slowGet = async <T>(result: T): Promise<T> => {
  await sleep(100); // force module to correctly handle an async function
  return result;
};

/* eslint-disable @typescript-eslint/camelcase */
const mockComment = (
  id?: string,
  parentId?: string,
  body?: string,
  author?: string
): object => ({
  get parent_id(): Promise<string> {
    return slowGet(parentId || "t1_parent");
  },
  get id(): Promise<string> {
    return slowGet(id || "t1_myself");
  },
  get body(): Promise<string> {
    return slowGet(body || "Lorem Ipsum");
  },
  get author(): Promise<{ name: Promise<string> }> {
    return slowGet({
      get name(): Promise<string> {
        return slowGet(author || "myName");
      }
    });
  },
  get created_utc(): Promise<number> {
    return slowGet(Math.floor(Date.now() / 1000));
  },
  reply: jest.fn()
});
/* eslint-enable @typescript-eslint/camelcase */

jest.mock("./redditUtils.ts", (): { [name: string]: jest.Mock<any, any> } => ({
  containsTriggerWord: jest.fn()
}));

describe("Listener", (): void => {
  describe("initialises", (): void => {
    it("all optional arguments correctly", (): void => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(),
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      expect(listener.header).toEqual("");
      expect(listener.footer).toEqual("");
      expect(listener.cooldown).toEqual(10);
      expect(listener.responseType).toEqual("random");
      expect(listener.triggerCaseSensitive).toEqual(false);
      expect(listener.lastCommented).toBeNull();
    });
    it("a sequential Listener", (): void => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(),
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: [],
        responseType: ResponseTypes.sequential
      });
      // @ts-ignore
      expect((listener as SequentialListener).index).toEqual(0);
    });
    it("a function Listener", (): void => {
      const func = async (): Promise<string> => "";
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(),
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        func: func,
        responseType: ResponseTypes.function
      });
      // @ts-ignore
      expect((listener as FunctionListener).func).toEqual(func);
    });
  });

  describe("throws", (): void => {
    it("when no botUsername provided", (): void => {
      expect((): RandomListener | SequentialListener | FunctionListener =>
        // @ts-ignore
        Listener({
          name: "listenerName",
          initTime: new Date(),
          debug: false,
          triggerPhrase: "test",
          corpus: []
        })
      ).toThrow(
        Error(
          "Listener:listenerName - Listeners must know username of bot to prevent replying to itself"
        )
      );
    });
    it("when no triggerphrase provided", (): void => {
      expect((): void =>
        //@ts-ignore
        Listener({
          name: "listenerName",
          initTime: new Date(),
          botUsername: "mockBot",
          debug: false,
          corpus: []
        })
      ).toThrow(
        Error(
          "Listener:listenerName - Listeners require a provided trigger phrase or array of triggerphrases"
        )
      );
    });
    it("when no corpus provided (random)", (): void => {
      expect((): RandomListener | SequentialListener | FunctionListener =>
        // @ts-ignore
        Listener({
          name: "listenerName",
          initTime: new Date(),
          botUsername: "mockBot",
          debug: false,
          triggerPhrase: "test",
          responseType: ResponseTypes.random
        })
      ).toThrow(
        Error(
          "Listener:listenerName - Random and sequential Listeners require a provided corpus attribute"
        )
      );
    });
    it("when no corpus provided (sequential)", (): void => {
      expect((): RandomListener | SequentialListener | FunctionListener =>
        // @ts-ignore
        Listener({
          name: "listenerName",
          initTime: new Date(),
          botUsername: "mockBot",
          debug: false,
          triggerPhrase: "test",
          responseType: ResponseTypes.sequential
        })
      ).toThrow(
        Error(
          "Listener:listenerName - Random and sequential Listeners require a provided corpus attribute"
        )
      );
    });
    it("when no function provided (function)", (): void => {
      expect((): RandomListener | SequentialListener | FunctionListener => {
        // @ts-ignore
        return Listener({
          name: "listenerName",
          initTime: new Date(),
          botUsername: "mockBot",
          debug: false,
          triggerPhrase: "test",
          responseType: ResponseTypes.function
        });
      }).toThrow(
        Error(
          "Listener:listenerName - Function Listeners require a provided function attribute"
        )
      );
    });
    it("when unrecognised responseType", (): void => {
      expect((): RandomListener | SequentialListener | FunctionListener =>
        Listener({
          name: "listenerName",
          initTime: new Date(),
          botUsername: "mockBot",
          debug: false,
          triggerPhrase: "test",
          // @ts-ignore
          responseType: "blah"
        })
      ).toThrow(
        Error(
          "Listener:listenerName - Unrecognised Listener Type. Valid types are random,sequential,function"
        )
      );
    });
  });

  describe("shouldComment", (): void => {
    it("returns true when all default predicates met", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });

    it("returns false when has already commented less than cooldown minutes ago", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        cooldown: 2,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      listener.lastCommented = new Date(new Date().valueOf() - 1000 * 60);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("ignores cooldown if cooldown=0", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        cooldown: 0,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      listener.lastCommented = new Date();
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });

    it("returns false when comment was in the past", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() + 1000 * 60),
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when comment was by the bot", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "myName",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when comment did not contain trigger phrase", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => false);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when at least one custom predicate fails", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: [],
        customPredicates: [
          async (): Promise<boolean> => true,
          async (): Promise<boolean> => false
        ]
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns true when all custom predicates pass", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: [],
        customPredicates: [
          async (): Promise<boolean> => true,
          async (): Promise<boolean> => true
        ]
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });

    // Appease the branch coverage gods by repeating all tests with debug off
    it("returns true when all default predicates met", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });

    it("returns false when has already commented less than cooldown minutes ago", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        cooldown: 2,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      listener.lastCommented = new Date(new Date().valueOf() - 1000 * 60);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("ignores cooldown if cooldown=0", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        cooldown: 0,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      listener.lastCommented = new Date();
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });

    it("returns false when comment was in the past", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() + 1000 * 60),
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when comment was by the bot", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "myName",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when comment did not contain trigger phrase", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => false);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns false when at least one custom predicate fails", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: [],
        customPredicates: [
          async (): Promise<boolean> => true,
          async (): Promise<boolean> => false
        ]
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(false);
    });

    it("returns true when all custom predicates pass", async (): Promise<
      void
    > => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: [],
        customPredicates: [
          async (): Promise<boolean> => true,
          async (): Promise<boolean> => true
        ]
      });
      const mockContains = jest.spyOn(utils, "containsTriggerWord");
      mockContains.mockImplementationOnce(async (): Promise<boolean> => true);
      // @ts-ignore
      const result = await listener.shouldComment(mockComment() as Comment);
      expect(result).toEqual(true);
    });
  });

  describe("generateReply", (): void => {
    it("generates a random reply", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        header: "random:",
        triggerPhrase: "test",
        corpus: ["a", "b", "c"]
      });
      const mockRandom = jest.spyOn(Math, "random");
      mockRandom.mockImplementationOnce((): number => 0.01);
      mockRandom.mockImplementationOnce((): number => 0.99);
      mockRandom.mockImplementationOnce((): number => 0.5);
      // @ts-ignore
      let reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("random:a");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("random:c");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("random:b");
      expect(Math.random).toHaveBeenCalledTimes(3);
    });
    it("generates a sequential reply", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        footer: ":sequential",
        triggerPhrase: "test",
        corpus: ["a", "b", "c"],
        responseType: ResponseTypes.sequential
      });
      // @ts-ignore
      let reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("a:sequential");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("b:sequential");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("c:sequential");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("a:sequential");
      // @ts-ignore
      reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("b:sequential");
    });
    it("generates a function reply", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        header: "abc\n\n",
        footer: "\n\nxyz",
        triggerPhrase: "test",
        func: async (comment: Comment): Promise<string> =>
          `${await comment.id}some extra random text`,
        responseType: ResponseTypes.function
      });
      // @ts-ignore
      const reply = await listener.generateReply(mockComment() as Comment);
      expect(reply).toEqual("abc\n\nt1_myselfsome extra random text\n\nxyz");
    });
  });
  describe("run", (): void => {
    it("...runs", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: true,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const comment = mockComment() as Comment;
      listener.shouldComment = async (): Promise<boolean> => true;
      listener.generateReply = async (): Promise<string> => "reply";
      await listener.run(comment);
      expect(comment.reply).toHaveBeenCalledWith("reply");
    });
    it("does nothing on shouldComment=false", async (): Promise<void> => {
      const listener = Listener({
        name: "listenerName",
        initTime: new Date(new Date().valueOf() - 1000 * 60), // simulate started one minute ago
        debug: false,
        botUsername: "mockBot",
        triggerPhrase: "test",
        corpus: []
      });
      // @ts-ignore
      const comment = mockComment() as Comment;
      listener.shouldComment = async (): Promise<boolean> => false;
      await listener.run(comment);
      expect(comment.reply).not.toHaveBeenCalled();
    });
  });
});
