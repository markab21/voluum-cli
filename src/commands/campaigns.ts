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

function normalizeCampaignsResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.campaigns)) {
    return payload.campaigns;
  }

  return payload;
}

export function registerCampaignCommands(program: Command): void {
  const campaigns = program.command("campaigns").description("Campaign operations");

  campaigns
    .command("list")
    .description("List campaigns")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.campaigns.listPath);
        await printJson(
          success({
            campaigns: normalizeCampaignsResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("get")
    .description("Get campaign by ID")
    .requiredOption("--id <id>", "Campaign ID")
    .action(async function action(this: Command, options: { id: string }) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.campaigns.getPath(options.id));
        await printJson(
          success({
            campaign: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("create")
    .description("Create a new campaign")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.campaigns.createPath, body);
        await printJson(
          success({
            campaign: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("update")
    .description("Update an existing campaign")
    .requiredOption("--id <id>", "Campaign ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.campaigns.updatePath(options.id), body);
        await printJson(
          success({
            campaign: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("delete")
    .description("Delete a campaign")
    .requiredOption("--id <id>", "Campaign ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.campaigns.deletePath(options.id));
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
