const BEARER_PREFIX = "Bearer ";

export class AuthHeaderError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "AuthHeaderError";
  }
}

export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader) {
    throw new AuthHeaderError("Missing Authorization header");
  }

  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    throw new AuthHeaderError("Authorization header must use Bearer token authentication");
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();

  if (!token) {
    throw new AuthHeaderError("Bearer token is missing");
  }

  return token;
}

export function unauthorizedResponse(message: string): Response {
  return Response.json(
    {
      error: "unauthorized",
      errorMessage: message,
      result: false
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="raindrop-mcp"'
      }
    }
  );
}
