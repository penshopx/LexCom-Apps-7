import { describe, expect, it } from "vitest";
import { limitAiRequest } from "@workspace/integrations-openai-ai-server/batch";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

describe("global AI request limiter", () => {
  it("keeps no more than four AI streams active at once", async () => {
    let activeStreams = 0;
    let peakActiveStreams = 0;

    const consumeStream = async (index: number) => {
      const stream = await limitAiRequest(async () =>
        (async function* () {
          activeStreams++;
          peakActiveStreams = Math.max(peakActiveStreams, activeStreams);
          try {
            await delay(25);
            yield index;
          } finally {
            activeStreams--;
          }
        })()
      );

      for await (const _item of stream) {
        // Consuming the stream keeps its limiter slot until completion.
      }
    };

    await Promise.all(Array.from({ length: 8 }, (_, index) => consumeStream(index)));

    expect(peakActiveStreams).toBe(4);
    expect(activeStreams).toBe(0);
  });
});