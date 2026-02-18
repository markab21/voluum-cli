import { Command } from "commander";
import { VoluumClient } from "../client/VoluumClient.js";
import { VoluumApiError } from "../client/errors.js";
import { clearStoredToken, saveConfig } from "../config/config.js";
import { AUTH_HEADER_NAME, ENDPOINTS, extractAuthToken, extractTokenExpiry } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  maskToken,
  printFailure,
  requireToken,
} from "./helpers.js";

interface LoginOptions {
  email?: string;
  password?: string;
  accessId?: string;
  accessKeyId?: string;
  accessKey?: string;
}

function validateLoginOptions(options: LoginOptions): "emailPassword" | "accessKeys" {
  const accessId = options.accessId ?? options.accessKeyId;
  const hasEmailPassword = Boolean(options.email) || Boolean(options.password);
  const hasAccessKeys = Boolean(accessId) || Boolean(options.accessKey);

  if (!hasEmailPassword && !hasAccessKeys) {
    throw new Error(
      "Provide either --email with --password, or --accessKeyId with --accessKey.",
    );
  }

  if (hasEmailPassword && hasAccessKeys) {
    throw new Error(
      "Use one auth method only: either --email/--password OR --accessKeyId/--accessKey.",
    );
  }

  if (hasEmailPassword && (!options.email || !options.password)) {
    throw new Error("Both --email and --password are required together.");
  }

  if (hasAccessKeys && (!accessId || !options.accessKey)) {
    throw new Error("Both --accessId (or --accessKeyId) and --accessKey are required together.");
  }

  return hasAccessKeys ? "accessKeys" : "emailPassword";
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Login and store session token locally")
    .option("--email <email>", "Voluum account email")
    .option("--password <password>", "Voluum account password")
    .option("--accessId <id>", "Voluum access ID")
    .option("--accessKeyId <id>", "Voluum access key ID")
    .option("--accessKey <key>", "Voluum access key")
    .action(async function action(this: Command, options: LoginOptions) {
      const command = this;
      try {
        const method = validateLoginOptions(options);
        const context = await createCommandContext(command);
        const accessId = options.accessId ?? options.accessKeyId;

        const loginClient = new VoluumClient(context.baseUrl, () => undefined, {
          authHeaderName: AUTH_HEADER_NAME,
        });

        const loginPath =
          method === "accessKeys"
            ? (ENDPOINTS.auth.accessLoginPath ?? ENDPOINTS.auth.loginPath)
            : ENDPOINTS.auth.loginPath;

        const payload =
          method === "accessKeys"
            ? {
                accessId,
                accessKey: options.accessKey,
              }
            : {
                email: options.email,
                password: options.password,
              };

        const loginResponse = await loginClient.post<unknown>(loginPath, payload);
        const token = extractAuthToken(loginResponse);

        if (!token) {
          throw new Error(
            "Login succeeded but no token was found in response. Update token extraction in src/endpoints.ts.",
          );
        }

        const tokenCreatedAt = new Date().toISOString();
        const tokenExpiresAt = extractTokenExpiry(loginResponse);

        await saveConfig({
          ...context.fileConfig,
          baseUrl: context.baseUrl,
          token,
          tokenCreatedAt,
          tokenExpiresAt,
          lastLoginEmail: options.email ?? context.fileConfig.lastLoginEmail,
        });

        await printJson(
          success({
            tokenSaved: true,
            tokenMasked: maskToken(token),
            baseUrl: context.baseUrl,
            tokenCreatedAt,
            tokenExpiresAt: tokenExpiresAt ?? null,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  auth
    .command("whoami")
    .description("Show current auth identity or local token metadata")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        const token = requireToken(context.token);

        const localMetadata = {
          tokenMasked: maskToken(token),
          tokenCreatedAt: context.fileConfig.tokenCreatedAt ?? null,
          tokenExpiresAt: context.fileConfig.tokenExpiresAt ?? null,
          baseUrl: context.baseUrl,
        };

        if (!ENDPOINTS.auth.whoamiPath) {
          await printJson(success({ source: "local", ...localMetadata }), getPrintOptions(command));
          return;
        }

        try {
          const identity = await context.client.get<unknown>(ENDPOINTS.auth.whoamiPath);
          await printJson(
            success({
              source: "remote",
              identity,
              ...localMetadata,
            }),
            getPrintOptions(command),
          );
        } catch (error) {
          if (error instanceof VoluumApiError && error.status === 404) {
            await printJson(
              success({
                source: "local",
                note: "whoami endpoint not found; returning local token metadata.",
                ...localMetadata,
              }),
              getPrintOptions(command),
            );
            return;
          }

          throw error;
        }
      } catch (error) {
        await printFailure(command, error);
      }
    });

  auth
    .command("logout")
    .description("Remove locally stored token")
    .action(async function action(this: Command) {
      const command = this;
      try {
        await clearStoredToken();
        await printJson(
          success({
            tokenRemoved: true,
            note: "Environment token VOLUUM_TOKEN (if set) still takes precedence for runtime auth.",
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
