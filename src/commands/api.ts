import { Command } from "commander";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  normalizePath,
  parseJsonBody,
  parseKeyValuePairs,
  printFailure,
} from "./helpers.js";

interface GetApiOptions {
  query?: string;
}

interface PostApiOptions {
  body: string;
  query?: string;
}

export function registerApiCommands(program: Command): void {
  const api = program.command("api").description("Generic API passthrough");

  api
    .command("get")
    .description("Send GET request to Voluum path")
    .argument("<path>", "API path (e.g. /campaign)")
    .option("--query <pairs>", "Comma-separated key=value query params")
    .action(async function action(this: Command, path: string, options: GetApiOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        const query = parseKeyValuePairs(options.query);
        const normalizedPath = normalizePath(path);

        const response = await context.client.get<unknown>(normalizedPath, query);
        await printJson(
          success({
            method: "GET",
            path: normalizedPath,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  api
    .command("post")
    .description("Send POST request to Voluum path")
    .argument("<path>", "API path (e.g. /report)")
    .requiredOption("--body <json>", "JSON body string")
    .option("--query <pairs>", "Comma-separated key=value query params")
    .action(async function action(this: Command, path: string, options: PostApiOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        const query = parseKeyValuePairs(options.query);
        const normalizedPath = normalizePath(path);
        const body = parseJsonBody(options.body);

        const response = await context.client.post<unknown>(normalizedPath, body, query);
        await printJson(
          success({
            method: "POST",
            path: normalizedPath,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
