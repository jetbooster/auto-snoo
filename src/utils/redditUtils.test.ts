/* eslint-disable @typescript-eslint/camelcase */
import utils from "./redditUtils";

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

const mockRedditClient = {
  getComment: jest.fn(
    async (): Promise<object> => {
      await sleep(100);
      return mockComment(
        "t1_parent",
        "t1_grandparent",
        "Lorem Bacon",
        "fathersName"
      );
    }
  )
};

describe("Reddit Utils", (): void => {
  beforeEach((): void => {
    mockRedditClient.getComment.mockClear();
  });

  describe("getParentComment", (): void => {
    it("gets parent as expected", async (): Promise<void> => {
      const parent = await utils.getParentComment(
        // @ts-ignore
        mockRedditClient,
        mockComment()
      );
      expect(await parent.id).toEqual("t1_parent");

      // yes, this is the most efficient method. Yes it is horrible.
      expect(await (await parent.author).name).toEqual("fathersName");

      expect(await parent.parent_id).toEqual("t1_grandparent");
      expect(await parent.id).toEqual("t1_parent");
    });

    it("returns undefined when parent is not a comment (ie, the comment is top level)", async (): Promise<
      void
    > => {
      const parent = await utils.getParentComment(
        // @ts-ignore
        mockRedditClient,
        mockComment("t1_me", "t3_thethread")
      );
      expect(parent).toBeUndefined();
    });

    // onlyComments=false is never used currently, but make sure we don't accidentally break it
    it("returns parent even when not comment if onlyComments is false", async (): Promise<
      void
    > => {
      const parent = await utils.getParentComment(
        // @ts-ignore
        mockRedditClient,
        mockComment("t1_me", "t3_thethread"),
        false
      );
      expect(await parent.id).toEqual("t1_parent");
      expect(await (await parent.author).name).toEqual("fathersName");
      expect(await parent.parent_id).toEqual("t1_grandparent");
      expect(await parent.id).toEqual("t1_parent");
    });
  });

  describe("getCommentChain", (): void => {
    it("follows chain upwards until it reaches thread root", async (): Promise<
      void
    > => {
      mockRedditClient.getComment.mockImplementationOnce(
        async (): Promise<object> => {
          await sleep(100);
          return mockComment(
            "t1_parent",
            "t1_grandparent",
            "Lorem Bacon",
            "fathersName"
          );
        }
      );
      mockRedditClient.getComment.mockImplementationOnce(
        async (): Promise<object> => {
          await sleep(100);
          return mockComment(
            "t1_grandparent",
            "t1_ancestor",
            "Impsum Factum",
            "otherCommenter"
          );
        }
      );
      mockRedditClient.getComment.mockImplementationOnce(
        async (): Promise<object> => {
          await sleep(100);
          return mockComment(
            "t1_ancestor",
            "t3_root",
            "Ergo vis a vis",
            "topCommenter"
          );
        }
      );
      const chain = await utils.getCommentChain(
        // @ts-ignore
        mockRedditClient,
        mockComment()
      );
      /* eslint-disable @typescript-eslint/camelcase */
      expect(chain).toEqual([
        {
          author: "myName",
          body: "Lorem Ipsum",
          id: "t1_myself",
          parent_id: "t1_parent"
        },
        {
          author: "fathersName",
          body: "Lorem Bacon",
          id: "t1_parent",
          parent_id: "t1_grandparent"
        },
        {
          author: "otherCommenter",
          body: "Impsum Factum",
          id: "t1_grandparent",
          parent_id: "t1_ancestor"
        },
        {
          author: "topCommenter",
          body: "Ergo vis a vis",
          id: "t1_ancestor",
          parent_id: "t3_root"
        }
      ]);
      /* eslint-enable @typescript-eslint/camelcase */

      expect(mockRedditClient.getComment).toHaveBeenCalledTimes(3);
    });
  });

  describe("containsTriggerWord", (): void => {
    it("passes with case sensitivity off", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the triGgerWord",
          undefined
        ),
        "triggerword"
      );
      expect(result).toEqual(true);
    });
    it("fails with spaces", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the trigger word",
          undefined
        ),
        "triggerword"
      );
      expect(result).toEqual(false);
    });
    it("fails with caseSensitivity (capitals in text)", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the TriggerWord",
          undefined
        ),
        "triggerword",
        true
      );
      expect(result).toEqual(false);
    });
    it("fails with caseSensitivity (capitals in trigger)", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the triggerword",
          undefined
        ),
        "Triggerword",
        true
      );
      expect(result).toEqual(false);
    });
    it("passes with caseSensitivity", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the TriggerWord",
          undefined
        ),
        "TriggerWord",
        true
      );
      expect(result).toEqual(true);
    });
    it("passes with an array", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the trigger word",
          undefined
        ),
        ["triggerword", "none", "inside"]
      );
      expect(result).toEqual(true);
    });
    it("fails with an array (caseSensitive)", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the trigger word",
          undefined
        ),
        ["TriggerWord", "none", "inside"],
        true
      );
      expect(result).toEqual(true);
    });
    it("passes with a regex triggerphrase", async (): Promise<void> => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the tRiGGer word",
          undefined
        ),
        /\strigger\s/
      );
      expect(result).toEqual(true);
    });
    it("fails with a regex triggerphrase with caseSensitivity", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the trIgGer word",
          undefined
        ),
        /\strigger\s/,
        true
      );
      expect(result).toEqual(false);
    });
    it("fails with a regex triggerphrase with caseSensitivity in the trigger", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the trigger word",
          undefined
        ),
        /.*TriGger.*/,
        true
      );
      expect(result).toEqual(false);
    });
    it("passes with a array regex triggerphrase and handles linebreaks", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere\ninside\nI contain the tRiGGer word",
          undefined
        ),
        [/\strIgGer\s/, /I\scoNtaIn/]
      );
      expect(result).toEqual(true);
    });
    it("fail with a caseSensitive array regex triggerphrase", async (): Promise<
      void
    > => {
      const result = await utils.containsTriggerWord(
        // @ts-ignore
        mockComment(
          undefined,
          undefined,
          "somewhere inside I contain the tRiGGer word",
          undefined
        ),
        [/\strIgGer\s/, /I\scoNtaIn/i],
        true
      );
      expect(result).toEqual(false);
    });
    it("fails with wrong type", async (): Promise<void> => {
      let error;
      try {
        await utils.containsTriggerWord(
          // @ts-ignore
          mockComment(
            undefined,
            undefined,
            "somewhere inside I contain the trigger word",
            undefined
          ),
          { trigger: "wrong format" },
          true
        );
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(
        Error(
          "Trigger Phrase must be string or regex, or an array of the former"
        )
      );
    });
  });
});
