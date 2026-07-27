export function GET() {
  return Response.json({
    ok: true,
    service: "lumicap-chatgpt-app",
    version: "1.0.0",
  });
}
