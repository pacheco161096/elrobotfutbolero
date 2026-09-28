import { reviewSocialHits } from "@/lib/engines/context";
import { classifyTruth } from "@/lib/engines/truth";
import { brightDataMissing, facebookPageUrls, pollSocialSearch, readSocialHits, triggerSocialSearch } from "@/lib/integrations/bright-data";
import { describe, expect, it, vi } from "vitest";

describe("bright data", () => {
  it("no llama a Bright Data si falta la llave, el dataset o las fanpages", async () => {
    const fetchImpl = vi.fn();
    const result = await triggerSocialSearch(["https://www.facebook.com/local"], { BRIGHT_DATA_API_KEY: "llave" }, fetchImpl);
    expect(result.status).toBe("pending_credentials");
    expect(brightDataMissing({})).toEqual(["BRIGHT_DATA_API_KEY", "BRIGHT_DATA_DATASET_ID", "BRIGHT_DATA_PAGE_URLS"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("manda varias fanpages en una sola llamada y descarta lo que no es Facebook", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ snapshot_id: "s_1" }), { status: 200 }));
    const pages = facebookPageUrls("https://www.facebook.com/local, https://facebook.com/visita/, https://example.com/no, no-es-url");
    expect(pages).toEqual(["https://www.facebook.com/local", "https://www.facebook.com/visita"]);
    expect(facebookPageUrls("https://www.facebook.com/profile.php?id=61554706934513&sk=about")).toEqual([
      "https://www.facebook.com/profile.php?id=61554706934513",
    ]);
    const result = await triggerSocialSearch(pages, {
      BRIGHT_DATA_API_KEY: "llave",
      BRIGHT_DATA_DATASET_ID: "gd_demo",
      BRIGHT_DATA_PAGE_URLS: pages.join(","),
    }, fetchImpl);
    expect(result).toEqual({ status: "triggered", snapshotId: "s_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe("https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_demo&format=json");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer llave");
    expect(init.body).toBe(JSON.stringify([
      { url: "https://www.facebook.com/local", num_of_posts: 3 },
      { url: "https://www.facebook.com/visita", num_of_posts: 3 },
    ]));
  });

  it("espera el resultado y lee el texto público", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ready" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ post_text: "Dicen que se fue la luz en el estadio.", user_name: "Fanpage", url: "https://example.com/post" }]), { status: 200 }));
    const env = { BRIGHT_DATA_API_KEY: "llave", BRIGHT_DATA_DATASET_ID: "gd_demo" };
    expect(await pollSocialSearch("s_1", env, fetchImpl)).toEqual({ status: "pending" });
    expect(await pollSocialSearch("s_1", env, fetchImpl)).toEqual({
      status: "ready",
      hits: [{ text: "Dicen que se fue la luz en el estadio.", url: "https://example.com/post", author: "Fanpage", imageUrl: null }],
    });
  });

  it("una mención pública no se vuelve un hecho", () => {
    const hits = readSocialHits([{ text: "Se suspendió por lluvia según un aficionado del estadio." }]);
    const truth = classifyTruth({ origin: "claim", sources: [{ kind: "usuario", stance: "apoya", name: "publicación pública" }] });
    expect(truth).toBe("AFIRMACION_DE_UNA_FUENTE");
    const review = reviewSocialHits({ known: ["SUSPENDED · Querétaro vs Guadalajara"], hits });
    expect(review.decision).toBe("MONITOR");
    expect(review.claims).toHaveLength(1);
  });

  it("si el texto ya se conocía, no hay segundo post", () => {
    const review = reviewSocialHits({
      known: ["Se fue la luz."],
      hits: [{ text: "Se fue la luz.", url: null, author: null }],
    });
    expect(review.decision).toBe("DISCARD");
    expect(review.claims).toEqual([]);
  });
});
