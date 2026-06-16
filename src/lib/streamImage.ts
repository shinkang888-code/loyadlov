/**
 * Stream image generation from `/api/generate-image` (SSE).
 * Invokes onChunk(dataUrl, isFinal) as partial b64_json frames arrive.
 */
export async function streamImage(
  endpoint: string,
  prompt: string,
  onChunk: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`image stream ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames separated by blank line
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        const item = evt.data?.[0] ?? evt;
        const b64: string | undefined = item?.b64_json;
        if (b64) {
          const dataUrl = `data:image/png;base64,${b64}`;
          const isFinal = item?.type === "image" || item?.finish_reason === "stop" || !item?.partial_image_index;
          onChunk(dataUrl, !!isFinal);
        }
      } catch {
        // ignore non-JSON frames (e.g. keepalive)
      }
    }
  }
}
