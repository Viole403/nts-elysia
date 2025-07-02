import 'elysia';
import { JWTPayloadSpec } from '@elysiajs/jwt';
import { UserRole } from '@prisma/client';

// Custom JWT Payload Interface
interface AuthJWTPayload extends JWTPayloadSpec {
  id: string;
  email: string;
  role: UserRole;
}

declare module 'elysia' {
  interface Context {
    // Fundamental Elysia Context properties
    body: any; // Using 'any' for body to resolve immediate type errors, can be refined with specific schemas
    query: Record<string, string>;
    params: Record<string, string>;
    headers: Record<string, string | undefined>;
    request: Request;
    set: {
      status?: number;
      headers?: Record<string, string>;
      redirect?: string;
    };
    // Properties added by plugins
    jwt: { // Corrected type for jwt plugin
      sign: (payload: AuthJWTPayload) => Promise<string>;
      verify: (token: string) => Promise<AuthJWTPayload | false>;
    };
    bearer: string; // Added bearer property
    user?: { // User property from JWT plugin, allowing null
      id: string;
      email: string;
      role: UserRole;
    } | null;
    oauth2: { // Corrected type for oauth2 plugin
      google: () => Promise<string>;
      apple: () => Promise<string>;
      // Add other social providers if needed
    };
    write: (chunk: string) => void; // Added for SSE
    end: () => void; // Added for SSE
  }

  // Define a custom Elysia instance type that includes decorated properties
  interface Elysia {
    user: { // User property from JWT plugin, allowing null
      id: string;
      email: string;
      role: UserRole;
    } | null;
  }
}