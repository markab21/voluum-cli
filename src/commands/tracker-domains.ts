import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTrackerDomainsResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.trackerDomains)) {
    return payload.trackerDomains;
  }

  return payload;
}

export function registerTrackerDomainCommands(program: Command): void {
  const trackerDomains = program.command("tracker-domains").description("Tracker domain operations");

  trackerDomains
    .command("list")
    .description("List all tracker domains")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trackerDomains.listPath);
        await printJson(
          success({
            trackerDomains: normalizeTrackerDomainsResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("get")
    .description("Get tracker domain by ID")
    .requiredOption("--id <id>", "Tracker domain ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trackerDomains.getPath(options.id));
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("create")
    .description("Create a new tracker domain")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.trackerDomains.createPath, body);
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("update")
    .description("Update an existing tracker domain")
    .requiredOption("--id <id>", "Tracker domain ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.trackerDomains.updatePath(options.id), body);
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("delete")
    .description("Delete a tracker domain")
    .requiredOption("--id <id>", "Tracker domain ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.trackerDomains.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
