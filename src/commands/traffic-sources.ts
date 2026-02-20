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

function normalizeTrafficSourcesResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.trafficSources)) {
    return payload.trafficSources;
  }

  return payload;
}

export function registerTrafficSourceCommands(program: Command): void {
  const trafficSources = program.command("traffic-sources").description("Traffic source operations");

  trafficSources
    .command("list")
    .description("List all traffic sources")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trafficSources.listPath);
        await printJson(
          success({
            trafficSources: normalizeTrafficSourcesResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("get")
    .description("Get traffic source by ID")
    .requiredOption("--id <id>", "Traffic source ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trafficSources.getPath(options.id));
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("create")
    .description("Create a new traffic source")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.trafficSources.createPath, body);
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("update")
    .description("Update an existing traffic source")
    .requiredOption("--id <id>", "Traffic source ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.trafficSources.updatePath(options.id), body);
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("delete")
    .description("Delete a traffic source")
    .requiredOption("--id <id>", "Traffic source ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.trafficSources.deletePath(options.id));
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
