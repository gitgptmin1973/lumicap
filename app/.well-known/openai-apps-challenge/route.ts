export function GET() {
  const challenge = process.env.OPENAI_APPS_CHALLENGE;
  if (!challenge) {
    return new Response("Challenge token is not configured.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(challenge, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
