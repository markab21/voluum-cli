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

function normalizeOffersResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.offers)) {
    return payload.offers;
  }

  return payload;
}

export function registerOfferCommands(program: Command): void {
  const offers = program.command("offers").description("Offer operations");

  offers
    .command("list")
    .description("List all offers")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.offers.listPath);
        await printJson(
          success({
            offers: normalizeOffersResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("get")
    .description("Get offer by ID")
    .requiredOption("--id <id>", "Offer ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.offers.getPath(options.id));
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("create")
    .description("Create a new offer")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.offers.createPath, body);
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("update")
    .description("Update an existing offer")
    .requiredOption("--id <id>", "Offer ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.offers.updatePath(options.id), body);
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("delete")
    .description("Delete an offer")
    .requiredOption("--id <id>", "Offer ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.offers.deletePath(options.id));
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
